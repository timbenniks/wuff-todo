// Real Chrome worker runtime; synthetic API/OS feedback only. No live backend or push provider.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { totakeEngine as e } from "@wuff/contracts";
import {
  makeTotakeNotification,
  totakeReminderPath,
} from "@wuff/contracts/modules/totake/notification";
import {
  emptyTotake,
  applyTotakeAction,
} from "../packages/domain/src/modules/totake/state";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const source = await readFile("apps/web/public/reminder-worker.js", "utf8");
// Capture the shipped handlers, retaining real install/activate registration.
// Notification UI and authenticated network responses are deliberately simulated.
const instrument = `
self.__name = (fn) => fn; // tsx's named-function helper in serialized verification callbacks.
self.__wuffVerification = { handlers: {} };
const add = self.addEventListener.bind(self);
self.addEventListener = (name, handler, ...rest) => {
  self.__wuffVerification.handlers[name] = handler;
  return add(name, handler, ...rest);
};
`;
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/reminder-worker.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(instrument + source);
  } else if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>Synthetic worker verification</title>");
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
let browser: any;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin);
  const workerReady = context.waitForEvent("serviceworker");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/reminder-worker.js");
    await navigator.serviceWorker.ready;
  });
  const worker = await workerReady;
  for (const mode of [
    "medication",
    "equipment",
    "group-retry",
    "failure",
    "denied-feedback",
  ] as const) {
    const now = Math.floor(Date.now() / 60000) * 60000;
    let state = emptyTotake(now);
    for (let n = 0; n < (mode === "group-retry" ? 2 : 1); n++) {
      const treatment = e.newTreatment(
        mode === "equipment" ? "equipment" : "medication",
        "custom",
        Math.floor(state.now / 1440),
      );
      treatment.name = `Fictional worker item ${n}`;
      treatment.slots[0].time = e.time(state.now);
      treatment.inventory = {
        ...treatment.inventory,
        enabled: true,
        current: "10",
        threshold: "1",
      };
      state = applyTotakeAction(
        state,
        { action: "save_treatment", draft: treatment },
        randomUUID(),
        now,
      );
    }
    const group = state.groups.find((g) => g.items[0].alertInstant === now)!;
    assert(group);
    const userId = randomUUID();
    const notice = makeTotakeNotification(
      state,
      group,
      userId,
      randomUUID(),
      true,
      now,
    );
    const saved = applyTotakeAction(
      state,
      {
        action: "record",
        groupId: group.id,
        itemIds: group.items.map((i) => i.id),
        outcome: "taken",
      },
      randomUUID(),
      now,
    );
    const result = await worker.evaluate(
      async (input: any) => {
        const scope = globalThis as any;
        const shown: any[] = [],
          opened: string[] = [],
          bodies: string[] = [];
        let closed = 0;
        scope.registration.showNotification = async (...args: any[]) => {
          if (input.mode === "denied-feedback")
            throw Error("OS feedback denied");
          shown.push(args);
        };
        scope.clients.matchAll = async () => [];
        scope.clients.openWindow = async (url: string) => {
          opened.push(url);
        };
        scope.fetch = async (url: string, options: RequestInit) => {
          if (url !== "/api/v1/totake") throw Error("Unexpected request");
          if (options.method === "PUT") {
            bodies.push(options.body as string);
            if (input.mode === "group-retry" && bodies.length === 1)
              throw Error("Lost committed reply");
            if (input.mode === "failure" || input.mode === "denied-feedback")
              return new Response("{}", { status: 409 });
          }
          return new Response(
            JSON.stringify({
              userId: input.userId,
              version: options.method === "PUT" ? 2 : 1,
              state: options.method === "PUT" ? input.saved : input.state,
            }),
          );
        };
        let pending: Promise<unknown> | undefined;
        scope.__wuffVerification.handlers.notificationclick({
          action:
            input.mode === "group-retry"
              ? "totake-group-record"
              : "totake-record",
          notification: {
            data: { path: input.path, totake: input.notice },
            tag: "synthetic",
            close: () => {
              closed++;
            },
          },
          waitUntil: (promise: Promise<unknown>) => {
            pending = promise;
          },
        });
        await pending;
        return { shown, opened, bodies, closed };
      },
      {
        mode,
        userId,
        state,
        saved,
        notice,
        path: totakeReminderPath(group.id, userId),
      },
    );
    assert.equal(result.closed, 1);
    const failed = mode === "failure" || mode === "denied-feedback";
    assert.equal(result.opened.length, failed ? 1 : 0);
    assert.equal(result.shown.length, mode === "failure" ? 1 : 0);
    if (mode === "failure")
      assert.match(result.shown[0][1].body, /Couldn’t confirm/);
    assert.equal(result.bodies.length, mode === "group-retry" ? 2 : 1);
    if (mode === "group-retry")
      assert.equal(result.bodies[0], result.bodies[1]);
    const request = JSON.parse(result.bodies[0]);
    assert.equal(request.notification.userId, userId);
    assert.deepEqual(
      request.change.itemIds,
      group.items.map((i) => i.id),
    );
    if (failed) assert(result.opened[0].includes(encodeURIComponent(group.id)));
    console.log(`Chrome service worker: ${mode} passed`);
  }
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
