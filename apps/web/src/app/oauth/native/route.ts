import { database, oauthClients } from "@wuff/db";
import { appOrigin, nativeResource } from "@/lib/config";
import {
  nativeClientId,
  nativeRedirectUri,
  nativeScopes,
} from "@/lib/native-policy";
import { failure, privateJson } from "@/lib/http";

export async function GET() {
  try {
    // Stable registration, no arbitrary redirects and no per-device row growth.
    await database()
      .db.insert(oauthClients)
      .values({
        id: nativeClientId,
        name: "Wuff for iPhone and Android",
        redirectUris: [nativeRedirectUri],
      })
      .onConflictDoNothing();
    return privateJson({
      clientId: nativeClientId,
      redirectUri: nativeRedirectUri,
      resource: nativeResource(),
      scopes: nativeScopes,
      issuer: appOrigin(),
    });
  } catch (error) {
    return failure(error);
  }
}
