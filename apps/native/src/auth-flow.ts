import { tauriClientId, tauriRedirectUri, nativeScopes } from "@wuff/contracts";

export type AuthStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
};
type Pending = { state: string; verifier: string; createdAt: number };
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const nonce = () => encode(crypto.getRandomValues(new Uint8Array(32)));

// Serialize initiation/callback/cancellation so duplicate deep links cannot exchange twice.
export class BrowserAuthorization {
  private work: Promise<unknown> = Promise.resolve();
  constructor(
    private origin: string,
    private storage: AuthStorage,
    private exchange: (code: string, verifier: string) => Promise<unknown>,
  ) {}
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.work.then(fn, fn);
    this.work = next.catch(() => {});
    return next;
  }
  begin(withGithub = false): Promise<string> {
    return this.run(async () => {
      const pending: Pending = {
        state: nonce(),
        verifier: nonce(),
        createdAt: Date.now(),
      };
      const challenge = encode(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(pending.verifier),
          ),
        ),
      );
      await this.storage.write(JSON.stringify(pending));
      const url = new URL("/oauth/authorize", this.origin);
      url.search = new URLSearchParams({
        client_id: tauriClientId,
        redirect_uri: tauriRedirectUri,
        response_type: "code",
        code_challenge_method: "S256",
        code_challenge: challenge,
        state: pending.state,
        resource: this.origin + "/api/mobile",
        scope: [...nativeScopes, ...(withGithub ? ["github:manage"] : [])].join(
          " ",
        ),
      }).toString();
      return url.href;
    });
  }
  accept(value: string): Promise<boolean> {
    return this.run(async () => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return false;
      }
      const callback = new URL(tauriRedirectUri);
      if (
        url.protocol !== callback.protocol ||
        url.host !== callback.host ||
        url.pathname !== callback.pathname ||
        url.username ||
        url.password ||
        url.hash
      )
        return false;
      const raw = await this.storage.read();
      if (!raw) return false;
      let pending: Pending;
      try {
        pending = JSON.parse(raw);
      } catch {
        await this.storage.clear();
        throw new Error("Sign-in expired. Please start again.");
      }
      if (
        !pending ||
        typeof pending !== "object" ||
        !Number.isFinite(pending.createdAt) ||
        typeof pending.createdAt !== "number" ||
        Date.now() - pending.createdAt > 600_000 ||
        pending.createdAt > Date.now() ||
        !/^[\w-]{43}$/.test(pending.state) ||
        !/^[\w-]{43}$/.test(pending.verifier)
      ) {
        await this.storage.clear();
        throw new Error("Sign-in expired. Please start again.");
      }
      if (
        url.searchParams.getAll("state").length !== 1 ||
        url.searchParams.get("state") !== pending.state
      )
        throw new Error("Unexpected sign-in response. Please try again.");
      if (
        url.searchParams.getAll("iss").length !== 1 ||
        url.searchParams.get("iss") !== this.origin
      )
        throw new Error("Unexpected sign-in server.");
      await this.storage.clear();
      if (url.searchParams.has("error"))
        throw new Error("Sign-in was not authorized. Please try again.");
      const code = url.searchParams.get("code");
      if (!code || url.searchParams.getAll("code").length !== 1)
        throw new Error("Sign-in did not return an authorization code.");
      await this.exchange(code, pending.verifier);
      return true;
    });
  }
  cancel(): Promise<void> {
    return this.run(() => this.storage.clear());
  }
}
