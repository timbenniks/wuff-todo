import { notificationPolicy } from "./notification-settings";
import { createHash } from "node:crypto";
import { and, eq, or, sql, lte, inArray } from "drizzle-orm";
import { Client, Receiver } from "@upstash/qstash";
import { z } from "zod";
import {
  database,
  users,
  lists,
  members,
  tasks,
  receipts,
  reminderPreferences,
  reminderLists,
  reminderJobs,
  reminderDevices,
  reminderDeliveries,
} from "@wuff/db";
import {
  AppError,
  type Actor,
  type ReminderSettings,
  type PersonalReminder,
  reminderTimezoneSchema,
  reminderPreferencesSchema,
  updateReminderPreferencesSchema,
  updateListReminderSchema,
  listReminderSchema,
  taskReminderQuerySchema,
  setTaskReminderSchema,
  reminderDeviceSchema,
  removeReminderDeviceSchema,
} from "@wuff/contracts";
import {
  nextDailyReminder,
  respectQuietHours,
  reminderLocalDay,
} from "./reminder-time";
import {
  allowedPushEndpoint,
  reminderDeliveryStatus,
  sendReminderPush,
  PushTransportError,
  type PushPayload,
} from "./reminder-transport";
export { reminderDeliveryStatus } from "./reminder-transport";
export { localReminderInstant } from "./reminder-time";
type Db = ReturnType<typeof database>["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
function fail(code: string, message: string, status = 409): never {
  throw new AppError(code, message, status);
}
async function admitted(tx: Tx | Db, actor: Actor, scope = "lists:read") {
  if (!actor.scopes.includes(scope))
    fail(
      "forbidden",
      "This connection does not have permission for reminders.",
      403,
    );
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, actor.id), eq(users.enabled, true)));
  if (!user)
    fail("invite_required", "An invitation is required to use Wuff Todo.", 403);
}
async function access(tx: Tx | Db, actor: Actor, listId: string) {
  const [list] = await tx.select().from(lists).where(eq(lists.id, listId));
  const [member] =
    list?.ownerId === actor.id
      ? [true]
      : await tx
          .select()
          .from(members)
          .where(and(eq(members.listId, listId), eq(members.userId, actor.id)));
  if (!list || !member) fail("not_found", "List not found.", 404);
  return list;
}
async function personalWrite(
  actor: Actor,
  input: { operationId: string },
  fn: (tx: Tx) => Promise<unknown>,
) {
  await database().db.transaction(async (tx) => {
    await admitted(tx, actor, "tasks:write");
    // Match list mutations/callbacks: lock list before the personal actor lock.
    const listId = (input as { listId?: string }).listId;
    if (listId)
      await tx
        .select({ id: lists.id })
        .from(lists)
        .where(eq(lists.id, listId))
        .for("share");
    // Serialize personal settings, device changes and callback execution together.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${actor.id}`},0))`,
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.actorId, actor.id),
          eq(receipts.operationId, input.operationId),
        ),
      );
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        fail(
          "idempotency_conflict",
          "This operation ID was used for a different request.",
        );
      return;
    }
    await fn(tx);
    await tx.insert(receipts).values({
      actorId: actor.id,
      operationId: input.operationId,
      fingerprint,
      result: { id: actor.id },
    });
  });
}
async function preferences(tx: Tx | Db, userId: string) {
  const [saved] = await tx
    .select()
    .from(reminderPreferences)
    .where(eq(reminderPreferences.userId, userId));
  return {
    version: saved?.version ?? 0,
    preferences: reminderPreferencesSchema.parse(saved?.preferences ?? {}),
  };
}
export function reminderSchedulerReady() {
  return !!(
    process.env.QSTASH_TOKEN &&
    process.env.QSTASH_CURRENT_SIGNING_KEY &&
    process.env.QSTASH_NEXT_SIGNING_KEY &&
    process.env.WUFF_ORIGIN?.startsWith("https://")
  );
}
export async function getReminderSettings(
  actor: Actor,
): Promise<ReminderSettings> {
  const db = database().db;
  await admitted(db, actor);
  const personal = await preferences(db, actor.id);
  const devices = await db
    .select({
      id: reminderDevices.id,
      label: reminderDevices.label,
      transport: reminderDevices.transport,
    })
    .from(reminderDevices)
    .where(eq(reminderDevices.userId, actor.id));
  return {
    ...personal,
    devices,
    delivery: reminderDeliveryStatus(),
    publicKey: process.env.WEB_PUSH_PUBLIC_KEY ?? null,
    schedulerReady: reminderSchedulerReady(),
  };
}
const dto = (r: typeof reminderJobs.$inferSelect): PersonalReminder => ({
  id: r.id,
  taskId: r.taskId,
  version: r.version,
  runAt: r.runAt.toISOString(),
  enabled: r.enabled,
  scheduling: r.scheduling,
});
export async function getListReminders(actor: Actor, data: unknown) {
  const { listId } = listReminderSchema.parse(data),
    db = database().db;
  await admitted(db, actor);
  await access(db, actor, listId);
  const [setting] = await db
    .select()
    .from(reminderLists)
    .where(
      and(eq(reminderLists.userId, actor.id), eq(reminderLists.listId, listId)),
    );
  const jobs = await db
    .select({ job: reminderJobs })
    .from(reminderJobs)
    .innerJoin(tasks, eq(reminderJobs.taskId, tasks.id))
    .where(and(eq(reminderJobs.userId, actor.id), eq(tasks.listId, listId)));
  return {
    version: setting?.version ?? 0,
    dailyIncluded: setting?.dailyIncluded ?? true,
    reminders: jobs.map((r) => dto(r.job)),
  };
}
export async function updateReminderSettings(actor: Actor, data: unknown) {
  const input = updateReminderPreferencesSchema.parse(data);
  await personalWrite(actor, input, async (tx) => {
    const saved = await preferences(tx, actor.id);
    if (saved.version !== input.version)
      fail("conflict", "Reminder settings changed. Reload before saving.");
    await tx
      .insert(reminderPreferences)
      .values({
        userId: actor.id,
        version: input.version + 1,
        preferences: input.preferences,
      })
      .onConflictDoUpdate({
        target: reminderPreferences.userId,
        set: { version: input.version + 1, preferences: input.preferences },
      });
    const [digest] = await tx
      .select()
      .from(reminderJobs)
      .where(
        and(eq(reminderJobs.userId, actor.id), eq(reminderJobs.kind, "digest")),
      );
    const values = {
      runAt: nextDailyReminder(new Date(), input.preferences),
      enabled: input.preferences.dailyEnabled,
      scheduling: "pending",
      version: (digest?.version ?? 0) + 1,
      messageId: null,
    };
    if (digest)
      await tx
        .update(reminderJobs)
        .set(values)
        .where(eq(reminderJobs.id, digest.id));
    else
      await tx
        .insert(reminderJobs)
        .values({ ...values, userId: actor.id, kind: "digest" });
    // Pending task reminders are re-evaluated against new quiet hours at delivery.
  });
  await schedulePendingReminders(actor.id);
  return getReminderSettings(actor);
}
export async function updateListReminders(actor: Actor, data: unknown) {
  const input = updateListReminderSchema.parse(data);
  // Recheck authorization even for receipt replays.
  await admitted(database().db, actor);
  await access(database().db, actor, input.listId);
  await personalWrite(actor, input, async (tx) => {
    await access(tx, actor, input.listId);
    const [saved] = await tx
      .select()
      .from(reminderLists)
      .where(
        and(
          eq(reminderLists.userId, actor.id),
          eq(reminderLists.listId, input.listId),
        ),
      );
    if ((saved?.version ?? 0) !== input.version)
      fail("conflict", "Your list reminders changed. Reload before saving.");
    await tx
      .insert(reminderLists)
      .values({
        userId: actor.id,
        listId: input.listId,
        version: input.version + 1,
        dailyIncluded: input.dailyIncluded,
      })
      .onConflictDoUpdate({
        target: [reminderLists.userId, reminderLists.listId],
        set: { version: input.version + 1, dailyIncluded: input.dailyIncluded },
      });
  });
  return getListReminders(actor, { listId: input.listId });
}
export async function getTaskReminder(actor: Actor, data: unknown) {
  const input = taskReminderQuerySchema.parse(data),
    db = database().db;
  await admitted(db, actor);
  await access(db, actor, input.listId);
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, input.listId)));
  if (!task) fail("not_found", "Task not found.", 404);
  const [job] = await db
    .select()
    .from(reminderJobs)
    .where(
      and(
        eq(reminderJobs.userId, actor.id),
        eq(reminderJobs.taskId, input.taskId),
      ),
    );
  return { reminder: job ? dto(job) : null };
}
export async function setTaskReminder(actor: Actor, data: unknown) {
  const input = setTaskReminderSchema.parse(data);
  await getTaskReminder(actor, input);
  await personalWrite(actor, input, async (tx) => {
    const list = await access(tx, actor, input.listId);
    // Lock against a simultaneous completion/delete while creating the reminder.
    await tx.select().from(lists).where(eq(lists.id, list.id)).for("share");
    const [task] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.listId, input.listId)))
      .for("share");
    if (!task) fail("not_found", "Task not found.", 404);
    if (input.runAt && (task.completed || list.archived))
      fail(
        "task_inactive",
        "Restore the list and reopen the task before setting a reminder.",
      );
    const [job] = await tx
      .select()
      .from(reminderJobs)
      .where(
        and(
          eq(reminderJobs.userId, actor.id),
          eq(reminderJobs.taskId, input.taskId),
        ),
      );
    if ((job?.version ?? 0) !== input.version)
      fail("conflict", "This reminder changed. Reload before saving.");
    const p = (await preferences(tx, actor.id)).preferences;
    const requested = input.runAt ? new Date(input.runAt) : new Date();
    if (
      input.runAt &&
      (requested.getTime() <= Date.now() ||
        requested.getTime() > Date.now() + 366 * 86400000)
    )
      fail(
        "invalid_time",
        "Choose a future reminder within the next year.",
        400,
      );
    const values = {
      version: input.version + 1,
      enabled: !!input.runAt,
      runAt: respectQuietHours(requested, p),
      scheduling: "pending",
      messageId: null,
    };
    if (job)
      await tx
        .update(reminderJobs)
        .set(values)
        .where(eq(reminderJobs.id, job.id));
    else
      await tx.insert(reminderJobs).values({
        ...values,
        userId: actor.id,
        taskId: input.taskId,
        kind: "task",
      });
  });
  await schedulePendingReminders(actor.id);
  return getTaskReminder(actor, input);
}
export async function registerReminderDevice(actor: Actor, data: unknown) {
  const input = reminderDeviceSchema.parse(data);
  if (
    ["web", "windows"].includes(input.transport) &&
    !allowedPushEndpoint(input.address, input.transport as "web" | "windows")
  )
    fail(
      "invalid_endpoint",
      "This notification endpoint is not supported.",
      400,
    );
  await personalWrite(actor, input, async (tx) => {
    const [existing] = await tx
      .select()
      .from(reminderDevices)
      .where(
        and(
          eq(reminderDevices.transport, input.transport),
          eq(reminderDevices.address, input.address),
        ),
      );
    if (existing && existing.userId !== actor.id)
      fail(
        "device_in_use",
        "Disable notifications in the previous account before connecting this device.",
        409,
      );
    const values = {
      label: input.label,
      subscription: input.subscription ?? null,
    };
    if (existing)
      await tx
        .update(reminderDevices)
        .set(values)
        .where(eq(reminderDevices.id, existing.id));
    else {
      const count = await tx
        .select({ id: reminderDevices.id })
        .from(reminderDevices)
        .where(eq(reminderDevices.userId, actor.id));
      if (count.length >= 20)
        fail(
          "device_limit",
          "Remove an old device before adding another.",
          400,
        );
      await tx.insert(reminderDevices).values({
        ...values,
        userId: actor.id,
        transport: input.transport,
        address: input.address,
      });
    }
  });
  const { schedulePendingTotake } = await import("./totake-delivery");
  await schedulePendingTotake(actor.id);
  return getReminderSettings(actor);
}
export async function removeReminderDevice(actor: Actor, data: unknown) {
  const input = removeReminderDeviceSchema.parse(data);
  await personalWrite(actor, input, async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.id, input.deviceId),
          eq(reminderDevices.userId, actor.id),
        ),
      );
  });
  return getReminderSettings(actor);
}
export async function schedulePendingReminders(userId?: string) {
  if (!reminderSchedulerReady()) return;
  const db = database().db;
  const pending = await db
    .select()
    .from(reminderJobs)
    .where(
      and(
        eq(reminderJobs.enabled, true),
        eq(reminderJobs.scheduling, "pending"),
        userId ? eq(reminderJobs.userId, userId) : undefined,
      ),
    )
    .limit(100);
  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  for (const job of pending) {
    if ((await notificationPolicy(db, job.userId, "todo")).paused) continue;
    try {
      // Six-day hops stay below the free seven-day delay limit. Only jobs with
      // a real future deadline wake; there is no periodic minute poll.
      const wakeAt = Math.max(
        Date.now() + 1000,
        Math.min(job.runAt.getTime(), Date.now() + 6 * 86400000),
      );
      const result = await client.publishJSON({
        url: new URL("/api/internal/reminders", process.env.WUFF_ORIGIN!).href,
        body: { id: job.id, version: job.version },
        notBefore: Math.ceil(wakeAt / 1000),
        deduplicationId: `${job.id}:${job.version}:${Math.floor(wakeAt / 60000)}`,
        retries: 5,
      });
      await db
        .update(reminderJobs)
        .set({ scheduling: "scheduled", messageId: result.messageId })
        .where(
          and(
            eq(reminderJobs.id, job.id),
            eq(reminderJobs.version, job.version),
            eq(reminderJobs.scheduling, "pending"),
          ),
        );
    } catch {
      /* Durable pending row is retried on reads/writes and daily recovery. */
    }
  }
}
export async function verifyReminderCallback(
  signature: string,
  body: string,
  url: string,
) {
  if (
    !process.env.QSTASH_CURRENT_SIGNING_KEY ||
    !process.env.QSTASH_NEXT_SIGNING_KEY
  )
    return false;
  try {
    return await new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    }).verify({ signature, body, url });
  } catch {
    return false;
  }
}
const callbackSchema = z
  .object({ id: z.uuid(), version: z.number().int().positive() })
  .strict();
async function payloadFor(
  tx: Tx,
  job: typeof reminderJobs.$inferSelect,
  p: ReturnType<typeof reminderPreferencesSchema.parse>,
  lockedListIds: string[],
): Promise<PushPayload | null> {
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, job.userId), eq(users.enabled, true)))
    .for("share");
  if (!user || !lockedListIds.length) return null;
  const visible = and(
    inArray(lists.id, lockedListIds),
    or(
      eq(lists.ownerId, job.userId),
      sql`exists(select 1 from ${members} where ${members.listId}=${lists.id} and ${members.userId}=${job.userId})`,
    ),
  );
  if (job.taskId) {
    const [row] = await tx
      .select({ task: tasks, list: lists })
      .from(tasks)
      .innerJoin(lists, eq(tasks.listId, lists.id))
      .where(
        and(
          eq(tasks.id, job.taskId),
          eq(tasks.completed, false),
          eq(lists.archived, false),
          visible,
        ),
      )
      .for("share", { of: [tasks, lists] });
    if (!row) return null;
    return {
      title: "Wuff reminder",
      body: p.showTaskTitles ? row.task.title : "You have a task to check.",
      path: `/tasks/${row.task.id}`,
      tag: `wuff-${job.id}`,
    };
  }
  const rows = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(lists, eq(tasks.listId, lists.id))
    .where(
      and(
        eq(tasks.completed, false),
        eq(lists.archived, false),
        lte(tasks.dueDate, reminderLocalDay(new Date(), p.timezone)),
        visible,
        sql`not exists(select 1 from ${reminderLists} where ${reminderLists.userId}=${job.userId} and ${reminderLists.listId}=${lists.id} and ${reminderLists.dailyIncluded}=false)`,
      ),
    );
  if (!rows.length) return null;
  return {
    title: "Your daily Wuff nudge",
    body: `${rows.length} unfinished ${rows.length === 1 ? "task is" : "tasks are"} due today or overdue.`,
    path: "/lists",
    tag: `wuff-${job.id}`,
  };
}
// Dependency injection exercises the same permission/idempotency path with fake
// providers, without contacting real people or requiring provider credentials.
export async function deliverReminder(
  data: unknown,
  send = sendReminderPush,
  now = new Date(),
) {
  const input = callbackSchema.parse(data),
    db = database().db;
  const [initial] = await db
    .select()
    .from(reminderJobs)
    .where(eq(reminderJobs.id, input.id));
  if (!initial) return;
  let needsScheduling = false;
  const targets = await db
    .select({ id: reminderDevices.id })
    .from(reminderDevices)
    .where(eq(reminderDevices.userId, initial.userId));
  for (const target of targets) {
    await db.transaction(async (tx) => {
      // All callback paths take list locks before the personal actor/job locks,
      // matching list preference saves and task completion/revocation.
      const lockedLists = await tx
        .select({ id: lists.id })
        .from(lists)
        .where(
          initial.taskId
            ? sql`${lists.id} = (select ${tasks.listId} from ${tasks} where ${tasks.id}=${initial.taskId})`
            : or(
                eq(lists.ownerId, initial.userId),
                sql`exists(select 1 from ${members} where ${members.listId}=${lists.id} and ${members.userId}=${initial.userId})`,
              ),
        )
        .orderBy(lists.id)
        .for("share");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${initial.userId}`},0))`,
      );
      const [job] = await tx
        .select()
        .from(reminderJobs)
        .where(eq(reminderJobs.id, input.id))
        .for("update");
      if (!job?.enabled || job.version !== input.version) return;
      const policy = await notificationPolicy(tx, job.userId, "todo");
      if (policy.paused) return;
      const p = (await preferences(tx, job.userId)).preferences;
      const effective = respectQuietHours(job.runAt > now ? job.runAt : now, p);
      if (effective.getTime() > now.getTime() + 1000) {
        await tx
          .update(reminderJobs)
          .set({ runAt: effective, scheduling: "pending" })
          .where(eq(reminderJobs.id, job.id));
        needsScheduling = true;
        return;
      }
      const payload = await payloadFor(
        tx,
        job,
        p,
        lockedLists.map((l) => l.id),
      );
      if (!payload || now.getTime() - job.runAt.getTime() > 86400000) return;
      const [device] = await tx
        .select()
        .from(reminderDevices)
        .where(
          and(
            eq(reminderDevices.id, target.id),
            eq(reminderDevices.userId, job.userId),
          ),
        );
      if (!device) return;
      const [sent] = await tx
        .select()
        .from(reminderDeliveries)
        .where(
          and(
            eq(reminderDeliveries.jobId, job.id),
            eq(reminderDeliveries.version, job.version),
            eq(reminderDeliveries.deviceId, device.id),
          ),
        );
      if (sent) return;
      try {
        await send(
          device,
          policy.showContent
            ? payload
            : {
                ...payload,
                title: "Wuff Todo reminder",
                body: "Open Wuff to view your reminder.",
              },
        );
      } catch (e) {
        if (e instanceof PushTransportError && e.permanent) {
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
        .insert(reminderDeliveries)
        .values({ jobId: job.id, version: job.version, deviceId: device.id })
        .onConflictDoNothing();
    });
  }
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reminders:${initial.userId}`},0))`,
    );
    const [job] = await tx
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.id, input.id))
      .for("update");
    if (!job?.enabled || job.version !== input.version) return;
    const policy = await notificationPolicy(tx, job.userId, "todo");
    if (policy.paused) return;
    const p = (await preferences(tx, job.userId)).preferences;
    const effective = respectQuietHours(job.runAt > now ? job.runAt : now, p);
    if (effective.getTime() > now.getTime() + 1000) {
      await tx
        .update(reminderJobs)
        .set({ runAt: effective, scheduling: "pending" })
        .where(eq(reminderJobs.id, job.id));
      needsScheduling = true;
      return;
    }
    const [enabledUser] = await tx
      .select({ enabled: users.enabled })
      .from(users)
      .where(eq(users.id, job.userId));
    if (job.kind === "digest" && p.dailyEnabled && enabledUser?.enabled) {
      await tx
        .update(reminderJobs)
        .set({
          version: job.version + 1,
          runAt: nextDailyReminder(now, p),
          scheduling: "pending",
          messageId: null,
        })
        .where(eq(reminderJobs.id, job.id));
      needsScheduling = true;
    } else
      await tx
        .update(reminderJobs)
        .set({ enabled: false, scheduling: "finished" })
        .where(eq(reminderJobs.id, job.id));
  });
  if (needsScheduling) await schedulePendingReminders(initial.userId);
}

export async function recoverReminderScheduling() {
  if (!reminderSchedulerReady()) return;
  await database()
    .db.update(reminderJobs)
    .set({ scheduling: "pending" })
    .where(
      and(
        eq(reminderJobs.enabled, true),
        eq(reminderJobs.scheduling, "scheduled"),
        lte(reminderJobs.runAt, new Date(Date.now() - 3600000)),
      ),
    );
  await schedulePendingReminders();
}
export async function disableBrowserReminders(actor: Actor, data: unknown) {
  const input = z
    .object({ operationId: z.uuid(), endpoint: z.string().max(2048) })
    .parse(data);
  await personalWrite(actor, input, async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.userId, actor.id),
          eq(reminderDevices.transport, "web"),
          eq(reminderDevices.address, input.endpoint),
        ),
      );
  });
  return { ok: true };
}

export async function resolveReminderLocalTime(actor: Actor, data: unknown) {
  await admitted(database().db, actor);
  const input = z
    .object({
      local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      timezone: reminderTimezoneSchema,
    })
    .parse(data);
  const { localReminderInstant } = await import("./reminder-time");
  return {
    runAt: localReminderInstant(input.local, input.timezone).toISOString(),
  };
}
