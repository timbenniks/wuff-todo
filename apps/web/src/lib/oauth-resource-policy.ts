// Reserve retired first-party identities so they can never become MCP grants.
export const retiredNativeClientIds = [
  "wuff-native-v1",
  "wuff-tauri-v1",
] as const;
export function isRetiredClient(clientId: string) {
  return (retiredNativeClientIds as readonly string[]).includes(clientId);
}
export function validResourceClient(
  clientId: string,
  resource: string,
  origin: string,
) {
  return (
    !!clientId && !isRetiredClient(clientId) && resource === `${origin}/api/mcp`
  );
}
