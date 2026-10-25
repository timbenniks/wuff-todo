import { z } from "zod";
import { AppError } from "@wuff/contracts";
import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { sealLiveLists } from "@/lib/live-server";

// User ID pins renewals to the account whose page requested the subscription.
// Identity itself still comes exclusively from the verified server session.
const input = z.object({ userId: z.string().min(1).max(200) }).strict();
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = input.parse(await jsonInput(request));
    const actor = await webActor();
    if (body.userId !== actor.id)
      throw new AppError(
        "account_changed",
        "Your signed-in account changed. Reload Wuff to continue.",
        409,
      );
    const config = await sealLiveLists(actor);
    if (!config)
      throw new AppError(
        "live_unavailable",
        "Live updates are unavailable. Regular refresh is still active.",
        503,
      );
    return privateJson(config);
  } catch (error) {
    return failure(error);
  }
}
