import {
  nativeClientId,
  nativeRedirectUri,
  tauriClientId,
  tauriRedirectUri,
} from "@wuff/contracts";
export {
  nativeClientId,
  nativeRedirectUri,
  nativeScopes,
  nativeAllowedScopes,
} from "@wuff/contracts";

export function validResourceClient(
  clientId: string,
  resource: string,
  origin: string,
) {
  return firstPartyRedirect(clientId) !== null
    ? resource === `${origin}/api/mobile`
    : resource === `${origin}/api/mcp`;
}

export function firstPartyRedirect(clientId: string): string | null {
  if (clientId === nativeClientId) return nativeRedirectUri;
  if (clientId === tauriClientId) return tauriRedirectUri;
  return null;
}
