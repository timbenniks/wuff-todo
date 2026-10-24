import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { database, members, reminderJobs, reminderPreferences } from "@wuff/db";
import { scopes, reminderPreferencesSchema } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  updateTask,
  deleteList,
  removeListMember,
  getReminderSettings,
  updateReminderSettings,
  getListReminders,
  updateListReminders,
  getTaskReminder,
  setTaskReminder,
  registerReminderDevice,
  removeReminderDevice,
  deliverReminder,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
if (process.env.QSTASH_TOKEN)
  throw Error("Provider-mocked suite requires QStash delivery disabled");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes };
const write = (l: { id: string; version: number }) => ({
  listId: l.id,
  version: l.version,
  operationId: crypto.randomUUID(),
});
after(() => database().pool.end());
test("personal reminder isolation, concurrent revisions, retries, lifecycle and callback deduplication", async () => {
  const db = database().db;
  const [oldPrefs] = await db
    .select()
    .from(reminderPreferences)
    .where(eq(reminderPreferences.userId, b.id));
  const [oldDigest] = await db
    .select()
    .from(reminderJobs)
    .where(and(eq(reminderJobs.userId, b.id), eq(reminderJobs.kind, "digest")));
  let list = await createList(a, {
    title: "Synthetic reminders",
    operationId: crypto.randomUUID(),
  });
  const deviceIds: string[] = [];
  try {
    list = await createTask(a, {
      ...write(list),
      title: "Synthetic overdue task",
      dueDate: "2020-01-01",
    });
    const task = list.tasks[0];
    await db.insert(members).values({ listId: list.id, userId: b.id });
    const oldListVersion = list.version;
    const before = await getReminderSettings(b);
    const preferences = {
      ...reminderPreferencesSchema.parse({}),
      dailyEnabled: true,
      quietEnabled: false,
    };
    const prefsRequest = {
      version: before.version,
      preferences,
      operationId: crypto.randomUUID(),
    };
    const setting = await updateReminderSettings(b, prefsRequest);
    assert.equal(setting.version, before.version + 1);
    assert.equal(
      (await updateReminderSettings(b, prefsRequest)).version,
      setting.version,
    );
    await assert.rejects(
      updateReminderSettings(b, {
        ...prefsRequest,
        preferences: { ...preferences, dailyEnabled: false },
      }),
      { code: "idempotency_conflict" },
    );
    const listSetting = {
      listId: list.id,
      version: 0,
      dailyIncluded: false,
      operationId: crypto.randomUUID(),
    };
    await updateListReminders(b, listSetting);
    assert.equal(
      (await getListReminders(a, { listId: list.id })).dailyIncluded,
      true,
    );
    assert.equal(
      (await getListReminders(b, { listId: list.id })).dailyIncluded,
      false,
    );
    assert.equal((await getList(a, list.id)).version, oldListVersion);
    const race = await Promise.allSettled(
      [true, false].map((dailyIncluded) =>
        updateListReminders(b, {
          ...listSetting,
          version: 1,
          dailyIncluded,
          operationId: crypto.randomUUID(),
        }),
      ),
    );
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      updateReminderSettings(
        { ...b, scopes: ["lists:read"] },
        { ...prefsRequest, operationId: crypto.randomUUID() },
      ),
      { code: "forbidden" },
    );
    const address = "d".repeat(64);
    const settings = await registerReminderDevice(b, {
      transport: "ios",
      address,
      label: "Synthetic iOS",
      operationId: crypto.randomUUID(),
    });
    deviceIds.push(
      settings.devices.find((d) => d.label === "Synthetic iOS")!.id,
    );
    assert.ok(!JSON.stringify(settings).includes(address));
    await assert.rejects(
      registerReminderDevice(a, {
        transport: "ios",
        address,
        label: "Forbidden takeover",
        operationId: crypto.randomUUID(),
      }),
      { code: "device_in_use" },
    );
    const runAt = new Date(Date.now() + 3600000).toISOString();
    const request = {
      listId: list.id,
      taskId: task.id,
      version: 0,
      runAt,
      operationId: crypto.randomUUID(),
    };
    const { reminder } = await setTaskReminder(b, request);
    assert.ok(reminder);
    assert.equal((await setTaskReminder(b, request)).reminder?.version, 1);
    assert.equal((await getTaskReminder(a, request)).reminder, null);
    let sends = 0;
    await Promise.all(
      [1, 2].map(() =>
        deliverReminder(
          { id: reminder.id, version: 1 },
          async () => {
            sends++;
          },
          new Date(runAt),
        ),
      ),
    );
    assert.equal(sends, 1);
    assert.equal((await getTaskReminder(b, request)).reminder?.enabled, false);
    const second = await registerReminderDevice(b, {
      transport: "android",
      address: "synthetic-android-token-123456789",
      label: "Synthetic Android",
      operationId: crypto.randomUUID(),
    });
    deviceIds.push(
      second.devices.find((d) => d.label === "Synthetic Android")!.id,
    );
    const retryJob = await setTaskReminder(b, {
      ...request,
      version: 1,
      operationId: crypto.randomUUID(),
    });
    let attempts = 0;
    const accepted = new Map<string, number>();
    const partial = async (device: { id: string }) => {
      attempts++;
      if (attempts === 2) throw Error("Synthetic provider outage");
      accepted.set(device.id, (accepted.get(device.id) ?? 0) + 1);
    };
    await assert.rejects(
      deliverReminder(
        { id: retryJob.reminder!.id, version: retryJob.reminder!.version },
        partial,
        new Date(runAt),
      ),
      { code: "push_unavailable" },
    );
    await deliverReminder(
      { id: retryJob.reminder!.id, version: retryJob.reminder!.version },
      partial,
      new Date(runAt),
    );
    assert.equal(accepted.size, 2);
    assert.ok([...accepted.values()].every((n) => n === 1));
    // Digest inclusion is personal and filters the actual authoritative query.
    let listPrefs = await getListReminders(b, { listId: list.id });
    await updateListReminders(b, {
      listId: list.id,
      version: listPrefs.version,
      dailyIncluded: false,
      operationId: crypto.randomUUID(),
    });
    let [digest] = await db
      .select()
      .from(reminderJobs)
      .where(
        and(eq(reminderJobs.userId, b.id), eq(reminderJobs.kind, "digest")),
      );
    await db
      .update(reminderJobs)
      .set({ runAt: new Date(runAt) })
      .where(eq(reminderJobs.id, digest.id));
    let without = 0,
      withIncluded = 0;
    await deliverReminder(
      { id: digest.id, version: digest.version },
      async (_d, p) => {
        without = Number(p.body.split(" ")[0]);
        assert.ok(!p.body.includes(task.title));
      },
      new Date(runAt),
    );
    listPrefs = await getListReminders(b, { listId: list.id });
    await updateListReminders(b, {
      listId: list.id,
      version: listPrefs.version,
      dailyIncluded: true,
      operationId: crypto.randomUUID(),
    });
    [digest] = await db
      .select()
      .from(reminderJobs)
      .where(eq(reminderJobs.id, digest.id));
    await db
      .update(reminderJobs)
      .set({ runAt: new Date(runAt) })
      .where(eq(reminderJobs.id, digest.id));
    await deliverReminder(
      { id: digest.id, version: digest.version },
      async (_d, p) => {
        withIncluded = Number(p.body.split(" ")[0]);
      },
      new Date(runAt),
    );
    assert.equal(withIncluded, without + 1);
    const reset = await setTaskReminder(b, {
      ...request,
      version: retryJob.reminder!.version,
      operationId: crypto.randomUUID(),
    });
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      completed: true,
    });
    list = await updateTask(a, {
      ...write(list),
      taskId: task.id,
      completed: false,
    });
    await deliverReminder(
      { id: reset.reminder!.id, version: reset.reminder!.version },
      async () => {
        sends++;
      },
      new Date(runAt),
    );
    assert.equal(
      sends,
      1,
      "completion permanently invalidates old callbacks even after reopening",
    );
    const beforeSql = await getTaskReminder(b, request);
    const sqlJob = await setTaskReminder(b, {
      ...request,
      version: beforeSql.reminder!.version,
      operationId: crypto.randomUUID(),
    });
    await db.execute(
      sql`update wuff_tasks set completed=true,status='done' where id=${task.id}`,
    );
    await db.execute(
      sql`update wuff_tasks set completed=false,status='todo' where id=${task.id}`,
    );
    await deliverReminder(
      { id: sqlJob.reminder!.id, version: sqlJob.reminder!.version },
      async () => {
        sends++;
      },
      new Date(runAt),
    );
    assert.equal(
      sends,
      1,
      "direct synchronization writes also invalidate reminders permanently",
    );
    const cancelled = await getTaskReminder(b, request);
    const revoked = await setTaskReminder(b, {
      ...request,
      version: cancelled.reminder!.version,
      operationId: crypto.randomUUID(),
    });
    await removeListMember(a, { ...write(list), userId: b.id });
    await deliverReminder(
      { id: revoked.reminder!.id, version: revoked.reminder!.version },
      async () => {
        sends++;
      },
      new Date(runAt),
    );
    assert.equal(sends, 1);
    await assert.rejects(setTaskReminder(b, request), { code: "not_found" });
    await assert.rejects(getListReminders(b, { listId: list.id }), {
      code: "not_found",
    });
  } finally {
    for (const deviceId of deviceIds)
      await removeReminderDevice(b, {
        deviceId,
        operationId: crypto.randomUUID(),
      });
    await db
      .delete(reminderJobs)
      .where(
        and(eq(reminderJobs.userId, b.id), eq(reminderJobs.kind, "digest")),
      );
    if (oldDigest) await db.insert(reminderJobs).values(oldDigest);
    await db
      .delete(reminderPreferences)
      .where(eq(reminderPreferences.userId, b.id));
    if (oldPrefs) await db.insert(reminderPreferences).values(oldPrefs);
    await deleteList(a, {
      ...write(await getList(a, list.id)),
      confirmed: true,
    });
  }
});
