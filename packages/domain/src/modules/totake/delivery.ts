import { reminderSchedulerReady } from "../../platform/scheduler";
import { Client } from "@upstash/qstash";
import { z } from "zod";
import { and, eq, sql, lt } from "drizzle-orm";
import {
  database,
  totakeJobs,
  totakeDeliveries,
  reminderDevices,
  users,
} from "@wuff/db";
import { totakeEngine as e, AppError } from "@wuff/contracts";
import {
  loadTotakeState,
  persistTotakeState,
  reconcileTotakeJob,
} from "./totake";
import { refreshTotake } from "./state";
import { notificationPolicy } from "../../platform/notification-settings";
import {
  sendReminderPush,
  PushTransportError,
  reminderDeliveryStatus,
} from "../../platform/reminder-transport";
const callback = z
  .object({ id: z.uuid(), version: z.number().int().positive() })
  .strict();
export const totakeDeliveryEnabled = () =>
  process.env.WUFF_TOTAKE_DELIVERY_ENABLED === "true";
export async function schedulePendingTotake(userId?: string) {
  if (!totakeDeliveryEnabled() || !reminderSchedulerReady()) return;
  const db = database().db,
    client = new Client({ token: process.env.QSTASH_TOKEN });
  const jobs = await db
    .select()
    .from(totakeJobs)
    .where(
      and(
        eq(totakeJobs.enabled, true),
        eq(totakeJobs.scheduling, "pending"),
        userId ? eq(totakeJobs.userId, userId) : undefined,
      ),
    )
    .limit(100);
  for (const job of jobs) {
    if ((await notificationPolicy(db, job.userId, "totake")).paused) continue;
    const devices = await db
      .select({ transport: reminderDevices.transport })
      .from(reminderDevices)
      .where(eq(reminderDevices.userId, job.userId));
    const configured = reminderDeliveryStatus();
    if (!devices.some((d) => configured[d.transport])) continue;
    const wake = Math.max(
      Date.now() + 1000,
      Math.min(job.runAt.getTime(), Date.now() + 6 * 86400000),
    );
    try {
      await client.publishJSON({
        url: new URL("/api/internal/totake", process.env.WUFF_ORIGIN!).href,
        body: { id: job.id, version: job.version },
        notBefore: Math.ceil(wake / 1000),
        deduplicationId: `totake:${job.id}:${job.version}:${Math.floor(wake / 60000)}`,
        retries: 5,
      });
      await db
        .update(totakeJobs)
        .set({ scheduling: "scheduled" })
        .where(
          and(
            eq(totakeJobs.id, job.id),
            eq(totakeJobs.version, job.version),
            eq(totakeJobs.scheduling, "pending"),
          ),
        );
    } catch {
      /* Durable pending rows are recovered by authenticated reads/writes and the daily recovery route. */
    }
  }
}
export async function deliverTotake(
  data: unknown,
  send = sendReminderPush,
  now = Date.now(),
) {
  const input = callback.parse(data);
  if (!totakeDeliveryEnabled()) return;
  const db = database().db;
  const [initial] = await db
    .select()
    .from(totakeJobs)
    .where(eq(totakeJobs.id, input.id));
  if (!initial) return;
  const targets = await db
    .select({ id: reminderDevices.id })
    .from(reminderDevices)
    .where(eq(reminderDevices.userId, initial.userId));
  // Each accepted device/group receipt commits separately so a later provider failure
  // does not discard earlier accepted sends. Remote acceptance itself remains at least once.
  for (const target of targets)
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${initial.userId}`},0))`,
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`totake:${initial.userId}`},0))`,
      );
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, initial.userId));
      if (!user?.enabled) return;
      const [job] = await tx
        .select()
        .from(totakeJobs)
        .where(eq(totakeJobs.id, input.id));
      if (
        !job?.enabled ||
        job.version !== input.version ||
        job.runAt.getTime() > now + 1000
      )
        return;
      const policy = await notificationPolicy(tx, initial.userId, "totake");
      if (policy.paused) return;
      const [device] = await tx
        .select()
        .from(reminderDevices)
        .where(
          and(
            eq(reminderDevices.id, target.id),
            eq(reminderDevices.userId, initial.userId),
          ),
        );
      if (!device) return;
      const { state } = await loadTotakeState(tx, initial.userId, now),
        s = refreshTotake(state, now);
      for (const g of s.groups) {
        const ids = e
          .pending(g)
          .filter(
            (i) =>
              (g.reminders[i.id].nextInstant ?? i.alertInstant ?? Infinity) <=
              now,
          );
        if (!ids.length) continue;
        const [sent] = await tx
          .select()
          .from(totakeDeliveries)
          .where(
            and(
              eq(totakeDeliveries.jobId, job.id),
              eq(totakeDeliveries.version, job.version),
              eq(totakeDeliveries.deviceId, device.id),
              eq(totakeDeliveries.groupId, g.id),
            ),
          );
        if (sent) continue;
        const path = `/totake?reminder=${encodeURIComponent(g.id)}`;
        try {
          await send(device, {
            title: "Wuff Totake reminder",
            body: policy.showContent
              ? ids
                  .map((i) => `${i.name} · ${i.dose}`)
                  .join("\n")
                  .slice(0, 1000)
              : "Open Wuff to view your reminder.",
            path,
            tag: `totake:${job.id}:${g.id}`,
          });
        } catch (error) {
          if (error instanceof PushTransportError && error.permanent) {
            await tx
              .delete(reminderDevices)
              .where(eq(reminderDevices.id, device.id));
            return;
          }
          throw new AppError(
            "push_unavailable",
            "Notification delivery will be retried.",
            503,
          );
        }
        await tx
          .insert(totakeDeliveries)
          .values({
            jobId: job.id,
            version: job.version,
            deviceId: device.id,
            groupId: g.id,
          })
          .onConflictDoNothing();
      }
    });
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${initial.userId}`},0))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`totake:${initial.userId}`},0))`,
    );
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, initial.userId));
    if (!user?.enabled) return;
    const [job] = await tx
      .select()
      .from(totakeJobs)
      .where(eq(totakeJobs.id, input.id));
    if (
      !job?.enabled ||
      job.version !== input.version ||
      job.runAt.getTime() > now + 1000
    )
      return;
    if ((await notificationPolicy(tx, initial.userId, "totake")).paused) return;
    const old = await loadTotakeState(tx, initial.userId, now),
      next = refreshTotake(old.state, now);
    for (const g of next.groups)
      for (const item of e.pending(g)) {
        const r = g.reminders[item.id];
        if ((r.nextInstant ?? item.alertInstant ?? Infinity) > now) continue;
        r.nextInstant = now + g.interval * 60000;
        r.next = e.wallAt(r.nextInstant, next.clock!.zone);
        r.started = true;
        r.visible = true;
        r.snoozedUntil = null;
        r.snoozedInstant = null;
      }
    await persistTotakeState(
      tx,
      initial.userId,
      old.state,
      next,
      old.version + 1,
    );
    await reconcileTotakeJob(tx, initial.userId, next);
  });
  await schedulePendingTotake(initial.userId);
}
export function totakeDeliveryStatus() {
  return {
    enabled: totakeDeliveryEnabled(),
    providers: reminderDeliveryStatus(),
  };
}

/** Once-daily recovery also re-arms due jobs whose provider retries were exhausted. */
export async function recoverTotakeScheduling(now = Date.now()) {
  const db = database().db,
    cutoff = new Date(now - 10 * 60000);
  const due = await db
    .select()
    .from(totakeJobs)
    .where(
      and(
        eq(totakeJobs.enabled, true),
        eq(totakeJobs.scheduling, "scheduled"),
        lt(totakeJobs.runAt, cutoff),
      ),
    )
    .limit(100);
  for (const candidate of due)
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`totake:${candidate.userId}`},0))`,
      );
      await tx
        .update(totakeJobs)
        .set({ version: sql`${totakeJobs.version}+1`, scheduling: "pending" })
        .where(
          and(
            eq(totakeJobs.id, candidate.id),
            eq(totakeJobs.version, candidate.version),
            eq(totakeJobs.enabled, true),
            eq(totakeJobs.scheduling, "scheduled"),
            lt(totakeJobs.runAt, cutoff),
          ),
        );
    });
  await schedulePendingTotake();
}
