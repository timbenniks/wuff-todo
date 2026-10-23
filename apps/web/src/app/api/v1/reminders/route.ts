import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import {
  disableBrowserReminders,
  getReminderSettings,
  getListReminders,
  getTaskReminder,
  updateReminderSettings,
  updateListReminders,
  setTaskReminder,
  registerReminderDevice,
  removeReminderDevice,
  localReminderInstant,
  schedulePendingReminders,
} from "@wuff/domain";
import { AppError, reminderTimezoneSchema } from "@wuff/contracts";
import { after } from "next/server";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const actor = await webActor(),
      query = new URL(request.url).searchParams;
    const result = query.has("taskId")
      ? await getTaskReminder(actor, {
          listId: query.get("listId"),
          taskId: query.get("taskId"),
        })
      : query.has("listId")
        ? await getListReminders(actor, { listId: query.get("listId") })
        : await getReminderSettings(actor);
    after(() => schedulePendingReminders(actor.id));
    return privateJson(result);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      { action, input } = await jsonInput(request);
    if (action === "localTime") {
      const value = z
        .object({
          local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
          timezone: reminderTimezoneSchema,
        })
        .parse(input);
      return privateJson({
        runAt: localReminderInstant(value.local, value.timezone).toISOString(),
      });
    }
    const actions = {
      disableBrowser: disableBrowserReminders,
      settings: updateReminderSettings,
      list: updateListReminders,
      task: setTaskReminder,
      device: registerReminderDevice,
      removeDevice: removeReminderDevice,
    };
    if (!Object.hasOwn(actions, action))
      throw new AppError("invalid_action", "Unknown reminder action.", 400);
    // Browser registration cannot spoof an installed native client's token.
    if (action === "device" && input?.transport !== "web")
      throw new AppError(
        "invalid_device",
        "Register native devices from the installed app.",
        400,
      );
    return privateJson(
      await actions[action as keyof typeof actions](actor, input),
    );
  } catch (e) {
    return failure(e);
  }
}
