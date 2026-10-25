import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import {
  database,
  users,
  reminderJobs,
  totakeJobs,
  reminderDevices,
  notificationPreferences,
  reminderDeliveries,
  totakeDeliveries,
} from "@wuff/db";
import { schedulePendingReminders } from "../packages/domain/src/modules/todo/reminders";
import { schedulePendingTotake } from "../packages/domain/src/modules/totake/delivery";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN ||
  process.env.WUFF_ORIGIN !== "http://localhost:3000"
)
  throw Error(
    "Isolated development only; no existing QStash credentials allowed",
  );
after(() => database().pool.end());
test("both real publishers use compatible deterministic IDs and preserve pending, retry, six-day hops, user scoping, pauses and Totake gates", async () => {
  const db = database().db,
    userId = crypto.randomUUID(),
    otherId = crypto.randomUUID(),
    jobId = crypto.randomUUID(),
    otherJobId = crypto.randomUUID();
  const realFetch = globalThis.fetch,
    realNow = Date.now;
  const names = [
    "QSTASH_URL",
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "WUFF_ORIGIN",
    "WUFF_TOTAKE_DELIVERY_ENABLED",
    "WEB_PUSH_PUBLIC_KEY",
    "WEB_PUSH_PRIVATE_KEY",
    "WEB_PUSH_SUBJECT",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const now = Math.floor(realNow() / 60000) * 60000 + 10000,
    day = 86400000;
  const calls: {
    id: string;
    body: { id: string; version: number };
    before: number;
    url: string;
    retries: string | null;
  }[] = [];
  let mode: "reject" | "unknown" | "accept" = "reject",
    published = 0;
  let supersede = false;
  const accepted = new Map<string, string>();
  const snapshot = async () => ({
    todo: (
      await db.select().from(reminderJobs).where(eq(reminderJobs.id, jobId))
    )[0],
    totake: (
      await db.select().from(totakeJobs).where(eq(totakeJobs.id, jobId))
    )[0],
  });
  const publish = async () => {
    await schedulePendingReminders(userId);
    await schedulePendingTotake(userId);
  };
  const pending = async (runAt = new Date(now + 9 * day), version = 1) => {
    await db
      .update(reminderJobs)
      .set({
        scheduling: "pending",
        messageId: null,
        runAt,
        version,
        enabled: true,
      })
      .where(eq(reminderJobs.id, jobId));
    await db
      .update(totakeJobs)
      .set({ scheduling: "pending", runAt, version, enabled: true })
      .where(eq(totakeJobs.id, jobId));
  };
  try {
    await db.insert(users).values(
      [userId, otherId].map((id) => ({
        id,
        email: `scheduler-${id}@example.invalid`,
        name: "Synthetic scheduling fixture",
      })),
    );
    for (const [id, owner] of [
      [jobId, userId],
      [otherJobId, otherId],
    ]) {
      await db.insert(reminderJobs).values({
        id,
        userId: owner,
        kind: "digest",
        runAt: new Date(now + 9 * day),
      });
      await db
        .insert(totakeJobs)
        .values({ id, userId: owner, runAt: new Date(now + 9 * day) });
      await db.insert(notificationPreferences).values({ userId: owner });
      await db.insert(reminderDevices).values({
        userId: owner,
        transport: "web",
        label: "Synthetic publishing fixture",
        address: `https://fcm.googleapis.com/fcm/send/synthetic-${owner}`,
      });
    }
    Object.assign(process.env, {
      QSTASH_URL: "https://qstash.invalid",
      QSTASH_TOKEN: "synthetic-test-token",
      QSTASH_CURRENT_SIGNING_KEY: "synthetic-current",
      QSTASH_NEXT_SIGNING_KEY: "synthetic-next",
      WUFF_ORIGIN: "https://scheduler.invalid",
      WUFF_TOTAKE_DELIVERY_ENABLED: "true",
      WEB_PUSH_PUBLIC_KEY: "synthetic-public",
      WEB_PUSH_PRIVATE_KEY: "synthetic-private",
      WEB_PUSH_SUBJECT: "https://scheduler.invalid",
    });
    Date.now = () => now;
    // Real SDK, real domain/DB; no request can escape this interception.
    globalThis.fetch = async (input, options) => {
      const url = String(input),
        headers = new Headers(options?.headers);
      if (!url.startsWith("https://qstash.invalid/v2/publish/"))
        return new Response(
          '{"error":"Unexpected test destination; network blocked"}',
          { status: 403 },
        );
      const id = headers.get("Upstash-Deduplication-Id") ?? "";
      calls.push({
        id,
        body: JSON.parse(options?.body as string),
        before: Number(headers.get("Upstash-Not-Before")),
        url,
        retries: headers.get("Upstash-Retries"),
      });
      if (mode === "reject" || !/^[a-f0-9]{64}$/.test(id))
        return new Response(
          JSON.stringify({ error: "DeduplicationId cannot contain ':'" }),
          { status: 400 },
        );
      const duplicate = accepted.has(id);
      if (!duplicate) accepted.set(id, `synthetic-message-${++published}`);
      if (mode === "unknown")
        return new Response("Acknowledgement lost", { status: 200 });
      if (supersede) {
        if (url.endsWith("/api/internal/reminders"))
          await db
            .update(reminderJobs)
            .set({ version: 2 })
            .where(eq(reminderJobs.id, jobId));
        else
          await db
            .update(totakeJobs)
            .set({ version: 2 })
            .where(eq(totakeJobs.id, jobId));
      }
      return Response.json(
        { messageId: accepted.get(id), deduplicated: duplicate },
        { status: duplicate ? 202 : 200 },
      );
    };
    await publish();
    let rows = await snapshot();
    assert.equal(calls.length, 2);
    assert.equal(rows.todo.scheduling, "pending");
    assert.equal(rows.todo.messageId, null);
    assert.equal(rows.totake.scheduling, "pending");
    assert.equal(rows.todo.enabled, true);
    assert.equal(rows.totake.enabled, true);
    assert.equal(rows.todo.runAt.getTime(), now + 9 * day);
    assert.equal(rows.totake.runAt.getTime(), now + 9 * day);
    // Regression: the former colon-separated values fail this actual-header assertion.
    for (const call of calls) {
      assert.match(call.id, /^[a-f0-9]{64}$/);
      assert.deepEqual(call.body, { id: jobId, version: 1 });
      assert.equal(call.before, Math.ceil((now + 6 * day) / 1000));
      assert.equal(call.retries, "5");
    }
    assert.notEqual(
      calls[0].id,
      calls[1].id,
      "Product identity separates otherwise identical jobs",
    );
    assert(calls[0].url.endsWith("/api/internal/reminders"));
    assert(calls[1].url.endsWith("/api/internal/totake"));
    const originalIds = calls.map((c) => c.id);
    // Provider accepted, but SDK cannot parse its reply: keep pending and safely replay.
    mode = "unknown";
    await publish();
    rows = await snapshot();
    assert.equal(rows.todo.scheduling, "pending");
    assert.equal(rows.todo.messageId, null);
    assert.equal(rows.totake.scheduling, "pending");
    assert.equal(published, 2);
    mode = "accept";
    await publish();
    rows = await snapshot();
    assert.deepEqual(
      calls.slice(-2).map((c) => c.id),
      originalIds,
    );
    assert.equal(
      published,
      2,
      "Identical retries reuse the accepted provider messages",
    );
    assert.equal(rows.todo.scheduling, "scheduled");
    assert.equal(rows.todo.messageId, accepted.get(originalIds[0]));
    assert.equal(rows.totake.scheduling, "scheduled");
    const beforeScheduled = calls.length;
    await publish();
    assert.equal(calls.length, beforeScheduled);
    // New generation and wake-minute remain distinct, preserving one-second overdue wake.
    await pending(new Date(now + 90000), 2);
    await publish();
    assert(
      calls
        .slice(-2)
        .every((c) => c.before === Math.ceil((now + 90000) / 1000)),
    );
    assert(calls.slice(-2).every((c, i) => c.id !== originalIds[i]));
    const generationIds = calls.slice(-2).map((c) => c.id);
    await pending(new Date(now + 150000), 2);
    await publish();
    assert(calls.slice(-2).every((c, i) => c.id !== generationIds[i]));
    await pending(new Date(now - 60000), 3);
    await publish();
    assert(
      calls.slice(-2).every((c) => c.before === Math.ceil((now + 1000) / 1000)),
    );
    // A provider reply for an obsolete generation cannot mark the newer row scheduled.
    await pending();
    supersede = true;
    await publish();
    supersede = false;
    rows = await snapshot();
    assert.equal(rows.todo.version, 2);
    assert.equal(rows.totake.version, 2);
    assert.equal(rows.todo.scheduling, "pending");
    assert.equal(rows.totake.scheduling, "pending");
    assert.equal(rows.todo.messageId, null);
    await publish();
    rows = await snapshot();
    assert.equal(rows.todo.scheduling, "scheduled");
    assert.equal(rows.totake.scheduling, "scheduled");
    // Pauses, readiness and gates must leave pending rows untouched and publish nothing.
    await pending();
    let count = calls.length;
    await db
      .update(notificationPreferences)
      .set({ paused: true })
      .where(eq(notificationPreferences.userId, userId));
    await publish();
    assert.equal(calls.length, count);
    await db
      .update(notificationPreferences)
      .set({ paused: false, todo: true, totake: true })
      .where(eq(notificationPreferences.userId, userId));
    await publish();
    assert.equal(calls.length, count);
    await db
      .update(notificationPreferences)
      .set({ todo: true, totake: false })
      .where(eq(notificationPreferences.userId, userId));
    await publish();
    assert.equal(calls.length, count + 1);
    assert(calls.at(-1)!.url.endsWith("/api/internal/totake"));
    count = calls.length;
    assert.equal((await snapshot()).todo.scheduling, "pending");
    await pending();
    await db
      .update(notificationPreferences)
      .set({ todo: false, totake: true })
      .where(eq(notificationPreferences.userId, userId));
    await publish();
    assert.equal(calls.length, count + 1);
    assert(calls.at(-1)!.url.endsWith("/api/internal/reminders"));
    count = calls.length;
    assert.equal((await snapshot()).totake.scheduling, "pending");
    await pending();
    await db
      .update(notificationPreferences)
      .set({ todo: false, totake: false })
      .where(eq(notificationPreferences.userId, userId));
    process.env.WUFF_TOTAKE_DELIVERY_ENABLED = "false";
    await schedulePendingTotake(userId);
    assert.equal(calls.length, count);
    process.env.WUFF_TOTAKE_DELIVERY_ENABLED = "true";
    delete process.env.WEB_PUSH_PRIVATE_KEY;
    await schedulePendingTotake(userId);
    assert.equal(calls.length, count);
    process.env.WEB_PUSH_PRIVATE_KEY = "synthetic-private";
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    await publish();
    assert.equal(calls.length, count);
    process.env.QSTASH_CURRENT_SIGNING_KEY = "synthetic-current";
    await db
      .update(reminderJobs)
      .set({ enabled: false })
      .where(eq(reminderJobs.id, jobId));
    await db
      .update(totakeJobs)
      .set({ enabled: false })
      .where(eq(totakeJobs.id, jobId));
    await publish();
    assert.equal(calls.length, count);
    assert.equal(
      (
        await db
          .select()
          .from(reminderJobs)
          .where(eq(reminderJobs.id, otherJobId))
      )[0].scheduling,
      "pending",
    );
    assert.equal(
      (
        await db.select().from(totakeJobs).where(eq(totakeJobs.id, otherJobId))
      )[0].scheduling,
      "pending",
    );
    assert.equal(
      (
        await db
          .select()
          .from(reminderDeliveries)
          .where(eq(reminderDeliveries.jobId, jobId))
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .select()
          .from(totakeDeliveries)
          .where(eq(totakeDeliveries.jobId, jobId))
      ).length,
      0,
    );
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await db.delete(users).where(inArray(users.id, [userId, otherId]));
  }
});
