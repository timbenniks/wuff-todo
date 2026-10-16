import { webActor } from "@/lib/auth/server";
import { failure, privateJson, sameOrigin } from "@/lib/http";
import { boundedBody } from "@/lib/bounded-body";
import { taskImageLimit, taskImageUploadSchema } from "@wuff/contracts";
import { uploadTaskImage } from "@wuff/domain";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor();
    const params = new URL(request.url).searchParams;
    const input = taskImageUploadSchema.parse({
      ...Object.fromEntries(params),
      version: params.has("version") ? Number(params.get("version")) : NaN,
    });
    return privateJson({
      image: await uploadTaskImage(
        actor,
        input,
        await boundedBody(request, taskImageLimit),
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
