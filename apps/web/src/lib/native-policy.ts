// One first-party public client. Custom schemes are never enabled for dynamic
// third-party registration. PKCE protects intercepted authorization codes.
import { nativeClientId } from "@wuff/contracts";
export {
  nativeClientId,
  nativeRedirectUri,
  nativeScopes,
} from "@wuff/contracts";

export function validResourceClient(
  clientId: string,
  resource: string,
  origin: string,
) {
  return clientId === nativeClientId
    ? resource === `${origin}/api/mobile`
    : resource === `${origin}/api/mcp`;
}
