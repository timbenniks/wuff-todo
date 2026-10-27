import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import {
  sendReminderPush,
  PushTransportError,
} from "../packages/domain/src/platform/reminder-transport";
const require = createRequire(
  new URL("../packages/domain/package.json", import.meta.url),
);
const webpush = require("web-push");

test("product urgency becomes the real Web Push header without changing browser notification data", async () => {
  const before = { ...process.env },
    vapid = webpush.generateVAPIDKeys(),
    recipient = webpush.generateVAPIDKeys();
  const endpoint = "https://fcm.googleapis.com/fcm/send/synthetic-urgency";
  const subscription = {
    endpoint,
    keys: {
      p256dh: recipient.publicKey,
      auth: randomBytes(16).toString("base64url"),
    },
  };
  try {
    Object.assign(process.env, {
      WEB_PUSH_PUBLIC_KEY: vapid.publicKey,
      WEB_PUSH_PRIVATE_KEY: vapid.privateKey,
      WEB_PUSH_SUBJECT: "mailto:fixture@example.invalid",
    });
    for (const urgency of ["high", "normal"] as const) {
      const notification = {
        title: "Private reminder",
        body: "Open Wuff to review.",
        path: "/totake",
        tag: "synthetic-reminder",
      };
      let calls = 0;
      let captured:
        { request: any; body: string; timeout?: number } | undefined;
      await sendReminderPush(
        {
          id: crypto.randomUUID(),
          label: "Fixture",
          transport: "web",
          address: endpoint,
          subscription,
        },
        { ...notification, urgency },
        {
          webSend: async (target, body, options) => {
            calls++;
            const request = webpush.generateRequestDetails(
              target,
              body,
              options,
            );
            captured = {
              request,
              body: String(body),
              timeout: options?.timeout,
            };
            return {} as any;
          },
        },
      );
      assert.equal(calls, 1);
      assert(captured);
      assert.equal(captured.request.headers.Urgency, urgency);
      assert.equal(captured.request.headers.TTL, 3600);
      assert.equal(captured.timeout, 10_000);
      assert.deepEqual(
        JSON.parse(captured.body),
        notification,
        "delivery metadata is not exposed to the worker",
      );
    }
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

test("high urgency preserves permanent-expiry and retryable-outage classification without extra sends", async () => {
  const before = { ...process.env };
  try {
    Object.assign(process.env, {
      WEB_PUSH_PUBLIC_KEY: "fixture",
      WEB_PUSH_PRIVATE_KEY: "fixture",
      WEB_PUSH_SUBJECT: "mailto:fixture@example.invalid",
    });
    const endpoint = "https://fcm.googleapis.com/fcm/send/synthetic-failure";
    for (const [statusCode, permanent] of [
      [410, true],
      [503, false],
    ] as const) {
      let calls = 0;
      let urgency: unknown;
      await assert.rejects(
        sendReminderPush(
          {
            id: crypto.randomUUID(),
            label: "Fixture",
            transport: "web",
            address: endpoint,
            subscription: {
              endpoint,
              keys: { p256dh: "fixture", auth: "fixture" },
            },
          },
          {
            urgency: "high",
            title: "Private reminder",
            body: "Open Wuff to review.",
            path: "/totake",
            tag: "synthetic-failure",
          },
          {
            webSend: async (_target, _body, options) => {
              calls++;
              urgency = options?.urgency;
              throw { statusCode };
            },
          },
        ),
        (e) => e instanceof PushTransportError && e.permanent === permanent,
      );
      assert.equal(calls, 1);
      assert.equal(urgency, "high");
    }
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
