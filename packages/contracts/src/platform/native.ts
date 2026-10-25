// First-party native OAuth configuration, shared by client and authorization server.
export const tauriClientId = "wuff-tauri-v1";
export const tauriRedirectUri =
  "com.timbenniks.wufftodo.tauri://oauth/callback";
export const nativeClientId = "wuff-native-v1";
export const nativeRedirectUri = "com.timbenniks.wufftodo://oauth/callback";
export const nativeScopes = [
  "lists:read",
  "tasks:write",
  "lists:manage",
] as const;
// Optional privileges require a new interactive authorization, never refresh.
export const nativeAllowedScopes = [
  "notes:read",
  "notes:write",
  "notes:manage",
  "totake:read",
  "totake:write",
  "notifications:read",
  "notifications:manage",
  ...nativeScopes,
  "github:manage",
  "empire:read",
  "empire:manage",
] as const;
