import { neonAuth } from "@/lib/auth/server";
import { failure, sameOrigin } from "@/lib/http";

// Public registration is closed. Managed-service sign-up must also be disabled.
// Only expose the login/session subset used by this first milestone.
const allowed = new Set(["sign-in/email", "sign-out", "get-session"]);
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
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
