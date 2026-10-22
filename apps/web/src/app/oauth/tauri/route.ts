import { database, oauthClients } from "@wuff/db";
import { appOrigin, nativeResource } from "@/lib/config";
import {
  tauriClientId,
  tauriRedirectUri,
  nativeScopes,
  nativeAllowedScopes,
} from "@wuff/contracts";
import { failure, privateJson } from "@/lib/http";

export async function GET() {
  try {
    // Stable registration, no arbitrary redirects and no per-device row growth.
    await database()
      .db.insert(oauthClients)
      .values({
        id: tauriClientId,
        name: "Wuff for desktop and mobile",
        redirectUris: [tauriRedirectUri],
      })
      .onConflictDoNothing();
    return privateJson({
      clientId: tauriClientId,
      redirectUri: tauriRedirectUri,
      resource: nativeResource(),
      scopes: nativeScopes,
      optionalScopes: nativeAllowedScopes.filter(
        (scope) => !(nativeScopes as readonly string[]).includes(scope),
      ),
      issuer: appOrigin(),
    });
  } catch (error) {
    return failure(error);
  }
}
