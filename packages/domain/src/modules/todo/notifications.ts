import { and, eq } from "drizzle-orm";
import { reminderJobs, reminderPreferences } from "@wuff/db";
import {
  reminderPreferencesSchema,
  type NotificationSettings,
} from "@wuff/contracts";
import { nextDailyReminder } from "../../platform/reminder-time";
import type { Tx } from "../../platform/access";
export async function reconcileTodoNotificationPause(
  tx: Tx,
  userId: string,
  previous: NotificationSettings,
  input: Pick<NotificationSettings, "paused" | "apps">,
) {
  const wasPaused = previous.paused || previous.apps.todo,
    paused = input.paused || input.apps.todo;
  if (wasPaused !== paused) {
    const jobs = await tx
      .select()
      .from(reminderJobs)
      .where(
        and(eq(reminderJobs.userId, userId), eq(reminderJobs.enabled, true)),
      );
    const [p] = await tx
      .select()
      .from(reminderPreferences)
      .where(eq(reminderPreferences.userId, userId));
    const now = new Date(),
      prefs = reminderPreferencesSchema.parse(p?.preferences ?? {});
    for (const job of jobs) {
      // Pause invalidates queued generations. Resume daily at the next scheduled time;
      // discard expired task sends, send at most the one still-current task reminder.
      const expired =
        job.kind === "task" && now.getTime() - job.runAt.getTime() > 86400000;
      await tx
        .update(reminderJobs)
        .set({
          version: job.version + 1,
          enabled: !expired,
          scheduling: expired ? "finished" : paused ? "paused" : "pending",
          messageId: null,
          ...(!paused
            ? {
                runAt:
                  job.kind === "digest"
                    ? nextDailyReminder(now, prefs)
                    : new Date(
                        Math.max(now.getTime() + 1000, job.runAt.getTime()),
                      ),
              }
            : {}),
        })
        .where(eq(reminderJobs.id, job.id));
    }
  }
}
