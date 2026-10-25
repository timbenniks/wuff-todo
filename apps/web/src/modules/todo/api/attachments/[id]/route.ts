import { webActor } from "@/lib/auth/server";
import { failure } from "@/lib/http";
import { readTaskImage } from "@wuff/domain";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await readTaskImage(await webActor(), id);
    return new Response(result.stream, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(result.image.bytes),
        "Cache-Control": "private, no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Disposition": 'inline; filename="task-image.webp"',
      },
    });
  } catch (error) {
    const response = failure(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
