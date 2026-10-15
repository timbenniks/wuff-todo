import { and, eq } from "drizzle-orm";
import { database, oauthClients, oauthTokens } from "@wuff/db";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { z } from "zod";
export async function GET() {
  try {
    const actor = await webActor();
    return privateJson(
      await database()
        .db.selectDistinct({ id: oauthClients.id, name: oauthClients.name })
        .from(oauthTokens)
        .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
        .where(
          and(eq(oauthTokens.userId, actor.id), eq(oauthTokens.revoked, false)),
        ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor();
    const { clientId } = z
      .object({ clientId: z.uuid() })
      .parse(await jsonInput(request));
    await database()
      .db.update(oauthTokens)
      .set({ revoked: true })
      .where(
        and(
          eq(oauthTokens.userId, actor.id),
          eq(oauthTokens.clientId, clientId),
        ),
      );
    return privateJson({ disconnected: true });
  } catch (error) {
    return failure(error);
  }
}
