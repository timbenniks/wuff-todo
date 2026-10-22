import {
  nativeClientId,
  nativeRedirectUri,
  type ListSummary,
  type TodoList,
} from "@wuff/contracts";
export {
  nativeClientId,
  nativeRedirectUri,
  nativeScopes,
  nativeAllowedScopes,
} from "@wuff/contracts";

export type NativeClientIdentity = { clientId: string; redirectUri: string };

export type NativeTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export type TokenStorage = {
  read(): Promise<NativeTokens | null>;
  write(tokens: NativeTokens): Promise<void>;
  clear(): Promise<void>;
};

export class ClientError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "network_error",
  ) {
    super(message);
  }
}

export function serverOrigin(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error(
      "Use an HTTPS Wuff server origin (HTTP loopback is allowed locally).",
    );
  return url.origin;
}

export class NativeClient {
  readonly origin: string;
  private tokens: NativeTokens | null = null;
  private refresh: Promise<NativeTokens> | null = null;
  private generation = 0;
  private exchanging = false;
  private superseded() {
    return new ClientError(
      "Sign-in changed while this request was running. Please try again.",
      0,
      "request_superseded",
    );
  }
  // Serial storage prevents a late refresh write from restoring signed-out data.
  private storageWork: Promise<void> = Promise.resolve();
  onSignedOut: () => void = () => {};
  constructor(
    origin: string,
    private storage: TokenStorage,
    private fetcher = fetch,
    private identity: NativeClientIdentity = {
      clientId: nativeClientId,
      redirectUri: nativeRedirectUri,
    },
  ) {
    this.origin = serverOrigin(origin);
  }
  private persist(work: () => Promise<void>) {
    const job = this.storageWork.then(work, work);
    this.storageWork = job.catch(() => {});
    return job;
  }
  async restore() {
    const generation = this.generation;
    const tokens = await this.storage.read();
    if (generation !== this.generation) return false;
    this.tokens = tokens;
    return Boolean(tokens);
  }
  private async request(path: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      return await this.fetcher(this.origin + path, {
        ...init,
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
      });
    } catch {
      throw new ClientError(
        "Couldn’t reach Wuff. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  private async tokenRequest(
    params: Record<string, string>,
    generation: number,
  ) {
    const response = await this.request("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...params,
        client_id: this.identity.clientId,
        resource: this.origin + "/api/mobile",
      }).toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      if (generation !== this.generation) throw this.superseded();
      if (data.error === "invalid_grant" && generation === this.generation)
        await this.clear();
      throw new ClientError(
        "Your connection couldn’t be renewed. Sign in again.",
        response.status,
        data.error,
      );
    }
    if (
      typeof data.access_token !== "string" ||
      typeof data.refresh_token !== "string" ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new ClientError("Wuff returned an invalid sign-in response.", 502);
    const tokens: NativeTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    if (generation !== this.generation) {
      await this.revoke(tokens).catch(() => {});
      throw this.superseded();
    }
    // A rotated refresh token must be stored before it is used by more requests.
    try {
      await this.persist(() => this.storage.write(tokens));
    } catch {
      // Best effort revoke if secure storage cannot retain the new credentials.
      await this.revoke(tokens).catch(() => {});
      if (generation === this.generation) await this.clear();
      throw new ClientError(
        "This device couldn’t securely save sign-in. Please try again.",
      );
    }
    if (generation !== this.generation) {
      await this.revoke(tokens).catch(() => {});
      throw this.superseded();
    }
    this.tokens = tokens;
    return tokens;
  }
  async exchange(code: string, verifier: string) {
    if (this.exchanging) throw this.superseded();
    this.exchanging = true;
    try {
      const previous = this.tokens;
      // An interactive permission upgrade supersedes in-flight requests/refreshes.
      // A late basic-grant refresh must not replace the newly consented grant.
      this.generation++;
      this.refresh = null;
      const tokens = await this.tokenRequest(
        {
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: this.identity.redirectUri,
        },
        this.generation,
      );
      if (previous) await this.revoke(previous).catch(() => {});
      return tokens;
    } finally {
      this.exchanging = false;
    }
  }
  private async accessToken() {
    if (!this.tokens)
      throw new ClientError("Please sign in.", 401, "unauthorized");
    if (this.tokens.expiresAt > Date.now() + 60_000)
      return this.tokens.accessToken;
    if (!this.refresh) {
      const generation = this.generation;
      this.refresh = this.tokenRequest(
        {
          grant_type: "refresh_token",
          refresh_token: this.tokens.refreshToken,
        },
        generation,
      ).finally(() => {
        if (generation === this.generation) this.refresh = null;
      });
    }
    return (await this.refresh).accessToken;
  }
  async call<T>(action: string, input?: unknown, userId?: string): Promise<T> {
    if (this.exchanging) throw this.superseded();
    const generation = this.generation;
    const token = await this.accessToken();
    if (generation !== this.generation) throw this.superseded();
    const response = await this.request("/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, input, userId }),
    });
    if (generation !== this.generation) throw this.superseded();
    const data = await response.json();
    if (generation !== this.generation) throw this.superseded();
    if (!response.ok) {
      if (response.status === 401 || data.error?.code === "account_changed")
        await this.clear();
      throw new ClientError(
        data.error?.message ?? "Couldn’t complete this change.",
        response.status,
        data.error?.code,
      );
    }
    return data as T;
  }
  async image(
    params: URLSearchParams,
    init: RequestInit = {},
    userId?: string,
  ) {
    if (this.exchanging) throw this.superseded();
    const generation = this.generation;
    const token = await this.accessToken();
    if (generation !== this.generation) throw this.superseded();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (userId) headers.set("X-Wuff-User", userId);
    const response = await this.request("/api/mobile/images?" + params, {
      ...init,
      headers,
    });
    if (generation !== this.generation) throw this.superseded();
    if (response.status === 401) await this.clear();
    return response;
  }
  lists() {
    return this.call<ListSummary[]>("listLists");
  }
  list(id: string) {
    return this.call<TodoList>("getList", id);
  }
  private revoke(tokens: NativeTokens) {
    return this.request("/oauth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.identity.clientId,
        token: tokens.refreshToken,
      }).toString(),
    });
  }
  async signOut() {
    const tokens = this.tokens;
    let localCleared = true;
    try {
      await this.clear();
    } catch {
      localCleared = false;
    }
    let remoteRevoked = true;
    if (tokens) {
      try {
        const response = await this.revoke(tokens);
        if (!response.ok) throw new Error();
      } catch {
        remoteRevoked = false;
      }
    }
    if (!localCleared)
      throw new ClientError(
        "This device couldn’t remove saved sign-in. Revoke this connection on the website before using this device again.",
      );
    if (!remoteRevoked)
      throw new ClientError(
        "Signed out on this device. Revoke its connection on the website to finish disconnecting it.",
      );
  }
  async clear() {
    this.generation++;
    this.tokens = null;
    this.onSignedOut();
    await this.persist(() => this.storage.clear());
  }
}

// Hold the exact payload after an ambiguous network/server failure. Explicit
// retry reuses its operation UUID and version; never silently regenerate either.
export class PendingMutation {
  private pending: { action: string; input: unknown } | null = null;
  constructor(private client: Pick<NativeClient, "call">) {}
  get hasPending() {
    return this.pending !== null;
  }
  async run<T>(action: string, input: unknown): Promise<T> {
    if (this.pending)
      throw new ClientError(
        "Retry the pending change before starting another.",
      );
    this.pending = { action, input: JSON.parse(JSON.stringify(input)) };
    return this.retry<T>();
  }
  async retry<T>(): Promise<T> {
    if (!this.pending) throw new ClientError("No pending change.");
    try {
      const result = await this.client.call<T>(
        this.pending.action,
        this.pending.input,
      );
      this.pending = null;
      return result;
    } catch (error) {
      if (
        error instanceof ClientError &&
        error.status >= 400 &&
        error.status < 500
      )
        this.pending = null;
      throw error;
    }
  }
  clear() {
    this.pending = null;
  }
}

export { NativeReminders } from "./reminders";
