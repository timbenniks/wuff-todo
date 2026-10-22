import { bearerActor } from "@/lib/oauth";
import { nativeResource } from "@/lib/config";
import { failure, privateJson } from "@/lib/http";
import { boundedBody } from "@/lib/bounded-body";
import {
  AppError,
  idSchema,
  taskImageLimit,
  taskImageUploadSchema,
} from "@wuff/contracts";
import { readTaskImage, uploadTaskImage } from "@wuff/domain";
export const runtime = "nodejs";
export const maxDuration = 30;
async function actor(request: Request) {
  let value;
  try {
    value = await bearerActor(request, nativeResource());
  } catch {
    throw new AppError("unauthorized", "Please sign in again.", 401);
  }
  const expected = request.headers.get("X-Wuff-User");
  if (expected && expected !== value.id)
    throw new AppError(
      "account_changed",
      "Your signed-in account changed.",
      409,
    );
  return value;
}
function errorResponse(error: unknown) {
  const response = failure(error);
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 401)
    response.headers.set("WWW-Authenticate", "Bearer");
  return response;
}
export async function POST(request: Request) {
  try {
    const viewer = await actor(request),
      params = new URL(request.url).searchParams;
    const input = taskImageUploadSchema.parse({
      ...Object.fromEntries(params),
      version: params.has("version") ? Number(params.get("version")) : NaN,
    });
    return privateJson({
      image: await uploadTaskImage(
        viewer,
        input,
        await boundedBody(request, taskImageLimit),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(request: Request) {
  try {
    const viewer = await actor(request),
      id = idSchema.parse(new URL(request.url).searchParams.get("id"));
    const result = await readTaskImage(viewer, id);
    return new Response(result.stream, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(result.image.bytes),
        "Cache-Control": "private, no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="task-image.webp"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
