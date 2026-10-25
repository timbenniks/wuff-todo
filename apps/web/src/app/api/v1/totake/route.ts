import { after } from "next/server";
import { schedulePendingTotake, schedulePendingReminders } from "@wuff/domain";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import { getTotake, updateTotake } from "@wuff/domain";
export async function GET(request: Request) {
  try {
    const actor = await webActor();
    after(async () => {
      await schedulePendingTotake(actor.id);
      await schedulePendingReminders(actor.id);
    });
    return privateJson(
      await getTotake(
        actor,
        new URL(request.url).searchParams.has("day")
          ? { day: Number(new URL(request.url).searchParams.get("day")) }
          : {},
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor();
    after(async () => {
      await schedulePendingTotake(actor.id);
      await schedulePendingReminders(actor.id);
    });
    return privateJson(await updateTotake(actor, await jsonInput(request)));
  } catch (e) {
    return failure(e);
  }
}
