import { after } from "next/server";
import { schedulePendingTotake, schedulePendingReminders } from "@wuff/domain";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@wuff/domain";
export async function GET() {
  try {
    const actor = await webActor();
    after(async () => {
      await schedulePendingTotake(actor.id);
      await schedulePendingReminders(actor.id);
    });
    return privateJson(await getNotificationSettings(actor));
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
    return privateJson(
      await updateNotificationSettings(actor, await jsonInput(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
