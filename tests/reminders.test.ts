import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reminderPreferencesSchema,
  reminderTimezoneSchema,
  setTaskReminderSchema,
  reminderDeviceSchema,
} from "@wuff/contracts";
import {
  nextDailyReminder,
  respectQuietHours,
  localReminderInstant,
} from "../packages/domain/src/platform/reminder-time";
import {
  allowedPushEndpoint,
  sendReminderPush,
  PushTransportError,
  reminderDeliveryStatus,
} from "../packages/domain/src/platform/reminder-transport";
const p = reminderPreferencesSchema.parse({});
test("reminder defaults are opt-in and validate timezone/quiet hours", () => {
  assert.equal(p.dailyEnabled, false);
  assert.equal(p.showTaskTitles, false);
  assert.equal(reminderTimezoneSchema.safeParse("Europe/Paris").success, true);
  assert.equal(reminderTimezoneSchema.safeParse("garbage").success, false);
  assert.equal(
    reminderPreferencesSchema.safeParse({
      ...p,
      quietStart: "08:00",
      quietEnd: "08:00",
    }).success,
    false,
  );
  assert.equal(
    setTaskReminderSchema.safeParse({
      operationId: crypto.randomUUID(),
      listId: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      version: 0,
      runAt: "2026-10-22T09:00:00",
    }).success,
    false,
  );
});
test("local recurring nudges follow spring/fall DST and quiet hours crossing midnight", () => {
  assert.equal(
    nextDailyReminder(new Date("2026-03-28T09:00:00Z"), p).toISOString(),
    "2026-03-29T07:00:00.000Z",
  );
  assert.equal(
    nextDailyReminder(new Date("2026-10-24T09:00:00Z"), p).toISOString(),
    "2026-10-25T08:00:00.000Z",
  );
  assert.equal(
    respectQuietHours(new Date("2026-10-22T21:00:00Z"), p).toISOString(),
    "2026-10-23T06:00:00.000Z",
  );
  assert.equal(
    respectQuietHours(new Date("2026-10-23T06:00:00Z"), p).toISOString(),
    "2026-10-23T06:00:00.000Z",
  );
  assert.equal(
    localReminderInstant("2026-03-29T02:30", "Europe/Paris").toISOString(),
    "2026-03-29T01:30:00.000Z",
  );
  assert.equal(
    localReminderInstant("2026-10-25T02:30", "Europe/Paris").toISOString(),
    "2026-10-25T00:30:00.000Z",
  );
});
test("registered push endpoints cannot target arbitrary hosts, credentials, ports or redirects", () => {
  for (const value of [
    "http://fcm.googleapis.com/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com:444/x",
    "https://a@fcm.googleapis.com/x",
  ])
    assert.equal(allowedPushEndpoint(value, "web"), false);
  assert.equal(
    allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/synthetic", "web"),
    true,
  );
  assert.equal(
    allowedPushEndpoint(
      "https://wns2-par.notify.windows.com/?token=synthetic",
      "web",
    ),
    true,
  );
  assert.equal(
    allowedPushEndpoint("https://evil.test/notify.windows.com", "web"),
    false,
  );
});
test("Web Push preserves payload/error behavior while native registration and delivery are retired", async () => {
  const original = { ...process.env };
  const payload = {
    title: "Synthetic title",
    body: "A <private> & safe task",
    path: "/lists",
    tag: "wuff-synthetic",
  };
  const target = {
    id: crypto.randomUUID(),
    label: "Synthetic device",
    address: "a".repeat(64),
    subscription: null,
  };
  try {
    Object.assign(process.env, {
      WEB_PUSH_SUBJECT: "mailto:synthetic@example.invalid",
      WEB_PUSH_PUBLIC_KEY: "fake",
      WEB_PUSH_PRIVATE_KEY: "fake",
    });
    for (const transport of ["ios", "macos", "android", "windows"] as const) {
      assert.equal(reminderDeliveryStatus()[transport], false);
      assert.equal(
        reminderDeviceSchema.safeParse({
          transport,
          address: target.address,
          label: target.label,
          operationId: crypto.randomUUID(),
        }).success,
        false,
      );
      await assert.rejects(
        sendReminderPush({ ...target, transport }, payload),
        (e) => e instanceof PushTransportError && e.permanent,
      );
    }
    let webBody = "";
    await sendReminderPush(
      {
        ...target,
        transport: "web",
        address: "https://fcm.googleapis.com/synthetic",
        subscription: {
          endpoint: "https://fcm.googleapis.com/synthetic",
          keys: { auth: "fake", p256dh: "fake" },
        },
      },
      payload,
      {
        webSend: async (_subscription, body) => {
          webBody = body as string;
          return {} as any;
        },
      },
    );
    assert.equal(JSON.parse(webBody).path, "/lists");
    await assert.rejects(
      sendReminderPush(
        {
          ...target,
          transport: "web",
          address: "https://fcm.googleapis.com/synthetic",
          subscription: {
            endpoint: "https://fcm.googleapis.com/synthetic",
            keys: { auth: "fake", p256dh: "fake" },
          },
        },
        payload,
        {
          webSend: async () => {
            throw { statusCode: 410 };
          },
        },
      ),
      (e) => e instanceof PushTransportError && e.permanent,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});

test("scheduler signatures bind callback URL, body, expiry and both rotation keys", async () => {
  const { createHash, createHmac } = await import("node:crypto");
  const { verifyReminderCallback } =
    await import("../packages/domain/src/modules/todo/reminders");
  const oldCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY,
    oldNext = process.env.QSTASH_NEXT_SIGNING_KEY;
  process.env.QSTASH_CURRENT_SIGNING_KEY = "synthetic-current";
  process.env.QSTASH_NEXT_SIGNING_KEY = "synthetic-next";
  const body = JSON.stringify({ id: crypto.randomUUID(), version: 1 }),
    url = "https://wuff.example.invalid/api/internal/reminders";
  function signed(key: string, exp: number) {
    const jwt = [
      { alg: "HS256", typ: "JWT" },
      {
        iss: "Upstash",
        sub: url,
        exp,
        body: createHash("sha256").update(body).digest("base64url"),
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
    return (
      jwt + "." + createHmac("sha256", key).update(jwt).digest("base64url")
    );
  }
  try {
    for (const key of ["synthetic-current", "synthetic-next"]) {
      const signature = signed(key, Math.floor(Date.now() / 1000) + 300);
      assert.equal(await verifyReminderCallback(signature, body, url), true);
      assert.equal(
        await verifyReminderCallback(signature, body + " ", url),
        false,
      );
      assert.equal(
        await verifyReminderCallback(signature, body, url + "/other"),
        false,
      );
    }
    assert.equal(
      await verifyReminderCallback(signed("synthetic-current", 1), body, url),
      false,
    );
    assert.equal(await verifyReminderCallback("invalid", body, url), false);
  } finally {
    if (oldCurrent === undefined) delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    else process.env.QSTASH_CURRENT_SIGNING_KEY = oldCurrent;
    if (oldNext === undefined) delete process.env.QSTASH_NEXT_SIGNING_KEY;
    else process.env.QSTASH_NEXT_SIGNING_KEY = oldNext;
  }
});
