import { neonAuth } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/http";
import { jsonInput } from "@/lib/http";
import { database, users } from "@wuff/db";
import { and, eq } from "drizzle-orm";
import {
  passwordRequest,
  passwordReset,
  requestPasswordPath,
  resetPasswordPath,
} from "@/lib/auth/password";

// Public registration is closed. Managed-service sign-up must also be disabled.
// Password activation/recovery is restricted to existing, admitted identities.
const allowed = new Set(["sign-in/email", "sign-out", "get-session"]);
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
    if (path === requestPasswordPath || path === resetPasswordPath) {
      if (request.method !== "POST")
        return new Response(null, { status: 405, headers: { Allow: "POST" } });
      sameOrigin(request);
      const body = (
        path === requestPasswordPath ? passwordRequest : passwordReset
      ).parse(await jsonInput(request));
      const [user] = await database()
        .db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, body.email), eq(users.enabled, true)));
      if (!user)
        return path === requestPasswordPath
          ? Response.json(
              { success: true },
              { headers: { "Cache-Control": "no-store" } },
            )
          : Response.json(
              { message: "The code is invalid or expired." },
              { status: 400 },
            );
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      return neonAuth()
        .handler()
        .POST(
          new Request(request.url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          }),
          context,
        );
    }
    if (!allowed.has(path))
      return Response.json(
        {
          error: {
            code: "invite_only",
            message: "Wuff Todo is invitation-only.",
          },
        },
        { status: 403 },
      );
    if (request.method !== "GET") sameOrigin(request);
    const handlers = neonAuth().handler();
    return handlers[request.method as "GET" | "POST"](request, context);
  } catch (error) {
    return failure(error);
  }
}
export const GET = handler;
export const POST = handler;
