import * as SecureStore from "expo-secure-store";
import {
  AuthRequest,
  CodeChallengeMethod,
  ResponseType,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
  NativeClient,
  nativeClientId,
  nativeRedirectUri,
  nativeScopes,
  type NativeTokens,
} from "@wuff/client";

WebBrowser.maybeCompleteAuthSession();
const origin =
  process.env.EXPO_PUBLIC_WUFF_ORIGIN || "https://wuff-todo.vercel.app";
// Environment-specific keys prevent development sessions being sent to production.
const key = `wuff.session.${encodeURIComponent(origin).replace(/%/g, "_")}`;
export const client = new NativeClient(origin, {
  async read() {
    const value = await SecureStore.getItemAsync(key);
    if (!value) return null;
    try {
      const tokens = JSON.parse(value) as NativeTokens;
      if (
        typeof tokens.accessToken !== "string" ||
        typeof tokens.refreshToken !== "string" ||
        !Number.isFinite(tokens.expiresAt)
      )
        throw new Error();
      return tokens;
    } catch {
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  write: (tokens) =>
    SecureStore.setItemAsync(key, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(key),
});

export async function signIn() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(client.origin + "/oauth/native", {
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(
        "This Wuff server doesn’t have mobile sign-in ready yet.",
      );
    const config = await response.json();
    if (
      config.clientId !== nativeClientId ||
      config.redirectUri !== nativeRedirectUri ||
      config.issuer !== client.origin ||
      config.resource !== client.origin + "/api/mobile"
    )
      throw new Error(
        "This server returned an unexpected sign-in configuration.",
      );
  } finally {
    clearTimeout(timeout);
  }
  const request = new AuthRequest({
    clientId: nativeClientId,
    redirectUri: nativeRedirectUri,
    responseType: ResponseType.Code,
    scopes: [...nativeScopes],
    usePKCE: true,
    codeChallengeMethod: CodeChallengeMethod.S256,
    extraParams: { resource: client.origin + "/api/mobile" },
  });
  const result = await request.promptAsync({
    authorizationEndpoint: client.origin + "/oauth/authorize",
  });
  if (result.type === "cancel" || result.type === "dismiss") return false;
  if (
    result.type !== "success" ||
    result.params.iss !== client.origin ||
    !result.params.code ||
    !request.codeVerifier
  )
    throw new Error("Sign-in wasn’t completed. Please try again.");
  await client.exchange(result.params.code, request.codeVerifier);
  return true;
}
