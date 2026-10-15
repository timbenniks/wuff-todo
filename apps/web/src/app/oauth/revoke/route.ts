import { and, eq, or } from "drizzle-orm";
import { database, oauthTokens } from "@wuff/db";
import { digest } from "@/lib/oauth";
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 8192)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  const params = new URLSearchParams(text);
  const token = params.get("token"),
    clientId = params.get("client_id");
  if (!token || !clientId)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  await database()
    .db.update(oauthTokens)
    .set({ revoked: true })
    .where(
      and(
        eq(oauthTokens.clientId, clientId),
        or(
          eq(oauthTokens.accessHash, digest(token)),
          eq(oauthTokens.refreshHash, digest(token)),
        ),
      ),
    );
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
