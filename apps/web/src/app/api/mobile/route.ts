import { after } from "next/server";
import { AppError } from "@wuff/contracts";
import { bearerActor } from "@/lib/oauth";
import { nativeResource } from "@/lib/config";
import { failure, jsonInput, privateJson } from "@/lib/http";
import { nativeOperation, nativeBackgroundJobs } from "@/modules/native";
import { z } from "zod";
// Bearer-only transport: admission, account pinning and audience checks precede product dispatch.
const envelope = z
  .object({
    action: z.string(),
    input: z.unknown().optional(),
    userId: z.string().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    let actor;
    try {
      actor = await bearerActor(request, nativeResource());
    } catch {
      throw new AppError("unauthorized", "Please sign in again.", 401);
    }
    const { action, input, userId } = envelope.parse(
      await jsonInput(request, 131_072),
    );
    if (userId && userId !== actor.id)
      throw new AppError(
        "account_changed",
        "Your signed-in account changed. Sign in again.",
        409,
      );
    const result = await nativeOperation(action)(actor, input);
    for (const job of nativeBackgroundJobs(action))
      after(async () => {
        await job();
      });
    return privateJson(result);
  } catch (error) {
    const response = failure(error);
    response.headers.set("Cache-Control", "no-store");
    if (response.status === 401)
      response.headers.set("WWW-Authenticate", "Bearer");
    return response;
  }
}
