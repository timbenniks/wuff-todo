import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  reminderPreferencesSchema,
  reminderTimezoneSchema,
  setTaskReminderSchema,
} from "@wuff/contracts";
import {
  nextDailyReminder,
  respectQuietHours,
  localReminderInstant,
} from "../packages/domain/src/reminder-time";
import {
  allowedPushEndpoint,
  sendReminderPush,
  PushTransportError,
} from "../packages/domain/src/reminder-transport";
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
      "windows",
    ),
    true,
  );
  assert.equal(
    allowedPushEndpoint("https://evil.test/notify.windows.com", "windows"),
    false,
  );
});
test("all transport adapters build provider-specific payloads and distinguish retired devices", async () => {
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
    const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString();
    Object.assign(process.env, {
      APNS_KEY_ID: "fake-key",
      APNS_TEAM_ID: "fake-team",
      APNS_IOS_TOPIC: "test.wuff.ios",
      APNS_MACOS_TOPIC: "test.wuff.macos",
      APNS_PRIVATE_KEY_BASE64: Buffer.from(ec).toString("base64"),
      WEB_PUSH_SUBJECT: "mailto:synthetic@example.invalid",
      WEB_PUSH_PUBLIC_KEY: "fake",
      WEB_PUSH_PRIVATE_KEY: "fake",
      WNS_CLIENT_ID: "fake",
      WNS_CLIENT_SECRET: "fake",
      WUFF_ORIGIN: "https://wuff.example.invalid",
    });
    for (const transport of ["ios", "macos"] as const) {
      let headers: any,
        body = "";
      const req = new EventEmitter() as any;
      req.setTimeout = () => {};
      req.end = (v: string) => {
        body = v;
        queueMicrotask(() => {
          req.emit("response", { ":status": 200 });
          req.emit("end");
        });
      };
      await sendReminderPush({ ...target, transport }, payload, {
        appleConnect: ((host: string) => ({
          on() {
            return this;
          },
          close() {},
          request(h: any) {
            headers = h;
            return req;
          },
        })) as any,
      });
      assert.equal(
        headers["apns-topic"],
        transport === "ios" ? "test.wuff.ios" : "test.wuff.macos",
      );
      assert.equal(headers["apns-push-type"], "alert");
      assert.equal(JSON.parse(body).aps.alert.body, payload.body);
      assert.equal(headers.authorization.split(".").length, 3);
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
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.FCM_SERVICE_ACCOUNT_BASE64 = Buffer.from(
      JSON.stringify({
        project_id: "synthetic-wuff",
        client_email: "synthetic@example.invalid",
        private_key: rsa,
      }),
    ).toString("base64");
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json(
        calls.length === 1
          ? { access_token: "fake-access" }
          : { name: "accepted" },
      );
    };
    await sendReminderPush({ ...target, transport: "android" }, payload, {
      fetch: fakeFetch,
    });
    const fcm = JSON.parse(calls[1].init.body as string).message;
    assert.equal(fcm.data.path, "/lists");
    assert.equal(fcm.android.notification.tag, payload.tag);
    assert.equal(fcm.token, target.address);
    calls.length = 0;
    await sendReminderPush(
      {
        ...target,
        transport: "windows",
        address: "https://wns2-par.notify.windows.com/synthetic",
      },
      payload,
      { fetch: fakeFetch },
    );
    assert.equal(
      (calls[1].init.headers as Record<string, string>)["X-WNS-Type"],
      "wns/toast",
    );
    assert.match(
      calls[1].init.body as string,
      /A &lt;private&gt; &amp; safe task/,
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
    await import("../packages/domain/src/reminders");
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
