import { eq, sql } from "drizzle-orm";
import { totakeJobs } from "@wuff/db";
import { type NotificationSettings } from "@wuff/contracts";
import type { Tx } from "../../platform/access";
export async function reconcileTotakeNotificationPause(
  tx: Tx,
  userId: string,
  previous: NotificationSettings,
  input: Pick<NotificationSettings, "paused" | "apps">,
) {
  if (
    (previous.paused || previous.apps.totake) !==
    (input.paused || input.apps.totake)
  ) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`totake:${userId}`},0))`,
    );
    await tx
      .update(totakeJobs)
      .set({
        version: sql`${totakeJobs.version}+1`,
        scheduling: input.paused || input.apps.totake ? "paused" : "pending",
        runAt: new Date(Date.now() + 1000),
      })
      .where(eq(totakeJobs.userId, userId));
  }
}
