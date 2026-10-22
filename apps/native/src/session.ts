import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { invoke } from "@tauri-apps/api/core";
const getPassword = (username: string) =>
  invoke<string>("plugin:keyring|get_password", { username });
const setPassword = (username: string, password: string) =>
  invoke<void>("plugin:keyring|set_password", { username, password });
const deletePassword = (username: string) =>
  invoke<void>("plugin:keyring|delete_password", { username });
const hasPassword = (username: string) =>
  invoke<boolean>("plugin:keyring|has_password", { username });
import { NativeClient, serverOrigin, type NativeTokens } from "@wuff/client";
import { tauriClientId, tauriRedirectUri } from "@wuff/contracts";
import { BrowserAuthorization } from "./auth-flow";

// Fixed build origin for now; expanding environments also requires scoped native permissions.
const origin = serverOrigin(
  import.meta.env.MODE === "development-local"
    ? "http://localhost:3000"
    : "https://wuff-todo.vercel.app",
);
function storage(name: string) {
  const key = `${origin}:${name}`;
  return {
    async read() {
      return (await hasPassword(key)) ? getPassword(key) : null;
    },
    async write(value: string) {
      try {
        await setPassword(key, value);
      } catch {
        throw new Error(
          "This device could not save sign-in in its credential store.",
        );
      }
    },
    async clear() {
      if (await hasPassword(key)) await deletePassword(key);
    },
  };
}
const credentials = storage("tokens");
export const client = new NativeClient(
  origin,
  {
    async read() {
      const raw = await credentials.read();
      if (!raw) return null;
      try {
        const value = JSON.parse(raw) as NativeTokens;
        if (
          !value ||
          typeof value.accessToken !== "string" ||
          !value.accessToken ||
          typeof value.refreshToken !== "string" ||
          !value.refreshToken ||
          !Number.isFinite(value.expiresAt)
        )
          throw new Error();
        return value;
      } catch {
        await credentials.clear();
        return null;
      }
    },
    write: (tokens) => credentials.write(JSON.stringify(tokens)),
    clear: () => credentials.clear(),
  },
  async (input, init) => {
    // The native plugin's redirect policy is explicit; never forward bearer headers through redirects.
    return nativeFetch(input, { ...init, maxRedirections: 0 });
  },
  { clientId: tauriClientId, redirectUri: tauriRedirectUri },
);
export const authorization = new BrowserAuthorization(
  origin,
  storage("pending-authorization"),
  (code, verifier) => client.exchange(code, verifier),
);

let loginAttempt = 0;
export async function signIn(withGithub = false) {
  const attempt = ++loginAttempt;
  const response = await nativeFetch(origin + "/oauth/tauri", {
    method: "GET",
    maxRedirections: 0,
    connectTimeout: 20_000,
  });
  if (!response.ok)
    throw new Error("This Wuff server is not ready for app sign-in yet.");
  const config = await response.json();
  if (
    config.clientId !== tauriClientId ||
    config.redirectUri !== tauriRedirectUri ||
    config.issuer !== origin ||
    config.resource !== origin + "/api/mobile"
  )
    throw new Error("Unexpected sign-in configuration.");
  if (attempt !== loginAttempt) return;
  const url = await authorization.begin(withGithub);
  if (attempt !== loginAttempt) {
    await authorization.cancel();
    return;
  }
  try {
    await openUrl(url);
  } catch {
    await authorization.cancel();
    throw new Error("Could not open the sign-in browser.");
  }
}
export async function signOut() {
  loginAttempt++;
  // Invalidate exchanges immediately, even while callback work is queued.
  const results = await Promise.allSettled([
    authorization.cancel(),
    client.signOut(),
  ]);
  for (const result of results)
    if (result.status === "rejected") throw result.reason;
}
export async function listenForSignIn(
  changed: () => void,
  failed: (error: unknown) => void,
) {
  let active = true;
  const accept = async (urls: string[]) => {
    for (const url of urls) {
      try {
        if ((await authorization.accept(url)) && active) changed();
      } catch (error) {
        if (active) failed(error);
      }
    }
  };
  const stop = await onOpenUrl((urls) => {
    if (active) void accept(urls);
  });
  try {
    await accept((await getCurrent()) ?? []);
  } catch (error) {
    if (active) failed(error);
  }
  return () => {
    active = false;
    stop();
  };
}
