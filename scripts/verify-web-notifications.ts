// Real local HTTP persistence + mocked OS PushManager. No push provider is contacted.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { database, reminderDevices } from "@wuff/db";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development with QStash disabled only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = "http://localhost:3000";
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const endpoint = `https://fcm.googleapis.com/fcm/send/synthetic-${crypto.randomUUID()}`;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext();
const installPushFixture = ({ endpoint }: { endpoint: string }) => {
  const state = {
    permission: "default",
    answer: "granted",
    subscribed: false,
    calls: [] as string[],
    key: new ArrayBuffer(0),
  };
  (window as any).__pushFixture = state;
  const subscription = {
    endpoint,
    get options() {
      return { applicationServerKey: state.key };
    },
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: btoa(String.fromCharCode(4) + String.fromCharCode(1).repeat(64))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
        auth: btoa(String.fromCharCode(1).repeat(16))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
      },
    }),
    unsubscribe: async () => {
      state.calls.push("unsubscribe");
      state.subscribed = false;
      return true;
    },
  };
  const registration = {
    pushManager: {
      getSubscription: async () => (state.subscribed ? subscription : null),
      subscribe: async (options: any) => {
        state.calls.push("subscribe");
        state.key = options.applicationServerKey.buffer;
        state.subscribed = true;
        return subscription;
      },
    },
  };
  Object.defineProperty(Notification, "permission", {
    configurable: true,
    get: () => state.permission,
  });
  Notification.requestPermission = async () => {
    state.calls.push("permission");
    state.permission = state.answer;
    return state.permission as NotificationPermission;
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: async () => {
        state.calls.push("register");
        return registration;
      },
      ready: Promise.resolve(registration),
      getRegistration: async () => registration,
    },
  });
};
// tsx preserves function names with this helper inside serialized callbacks.
await context.addInitScript({
  content: `(() => { const __name = (fn) => fn; (${installPushFixture.toString()})(${JSON.stringify({ endpoint })}); })();`,
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e: Error) => errors.push(e.message));
const writes: any[] = [];
let loseNext = false;
await page.route("**/api/v1/reminders", async (route: any) => {
  if (route.request().method() !== "POST") return route.continue();
  const input = route.request().postDataJSON();
  writes.push(input);
  if (loseNext && ["device", "disableBrowser"].includes(input.action)) {
    loseNext = false;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    return route.abort("failed");
  }
  return route.continue();
});
try {
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: user.email, password: user.password },
  });
  assert.equal(login.status(), 200);
  await page.goto(origin + "/settings/notifications");
  await page
    .getByRole("button", { name: "Enable this browser", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector("button") && (window as any).__pushFixture,
  );
  // Permission rejection is explicit and does not persist a device.
  await page.evaluate(() => {
    (window as any).__pushFixture.answer = "denied";
  });
  await page
    .getByRole("button", { name: "Enable this browser", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Notifications are blocked" })
    .waitFor();
  assert.equal(writes.length, 0);
  await page.evaluate(() => {
    const f = (window as any).__pushFixture;
    f.permission = "default";
    f.answer = "granted";
  });
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Delivery status refreshed" })
    .waitFor();
  // The server commits; an intentionally lost response must be retried identically.
  loseNext = true;
  await page
    .getByRole("button", { name: "Enable this browser", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .waitFor();
  const first = writes.at(-1);
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "previous request is confirmed" })
    .waitFor();
  assert.deepEqual(writes.at(-1), first);
  let devices = await database()
    .db.select()
    .from(reminderDevices)
    .where(eq(reminderDevices.address, endpoint));
  assert.equal(devices.length, 1);
  await page
    .getByRole("button", { name: "Reconnect this browser", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "This browser is registered" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        (window as any).__pushFixture.calls.filter(
          (c: string) => c === "subscribe",
        ).length,
    ),
    1,
  );
  // A long personal device label must not break the account layout.
  const rename = await context.request.post(origin + "/api/v1/reminders", {
    headers: { Origin: origin, "X-Wuff-User": user.id },
    data: {
      ...writes.at(-1),
      input: {
        ...writes.at(-1).input,
        label:
          "Synthetic browser with a very long personal label for responsive verification",
        operationId: crypto.randomUUID(),
      },
    },
  });
  assert.equal(rename.status(), 200);
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  await page
    .getByRole("listitem")
    .filter({
      hasText:
        "Synthetic browser with a very long personal label for responsive verification",
    })
    .waitFor();
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Fits ${width}px`,
    );
    await page.screenshot({
      path: `docs/screenshots/web-notifications-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Turn off this browser", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "turned off for this browser" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => (window as any).__pushFixture.subscribed),
    false,
  );
  devices = await database()
    .db.select()
    .from(reminderDevices)
    .where(eq(reminderDevices.address, endpoint));
  assert.equal(devices.length, 0);
  // Repeat removal with lost response to prove non-Settings {ok:true} recovery.
  await page
    .getByRole("button", { name: "Enable this browser", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "This browser is registered" })
    .waitFor();
  loseNext = true;
  await page
    .getByRole("button", { name: "Turn off this browser", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .waitFor();
  const remove = writes.at(-1);
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "previous request is confirmed" })
    .waitFor();
  assert.deepEqual(writes.at(-1), remove);
  assert.equal(
    (
      await database()
        .db.select()
        .from(reminderDevices)
        .where(eq(reminderDevices.address, endpoint))
    ).length,
    0,
  );
  await page.evaluate(() => {
    Reflect.deleteProperty(window, "PushManager");
  });
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  await page.getByText(/This browser cannot receive web push here/).waitFor();
  assert(
    await page
      .getByRole("button", { name: "Enable this browser", exact: true })
      .isDisabled(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Web notification browser checks passed: real local persistence, OS mocks, permission recovery, exact retries, reconnect/disconnect, keyboard and 320/390/1280px.",
  );
} finally {
  await context.close();
  await browser.close();
  await database()
    .db.delete(reminderDevices)
    .where(eq(reminderDevices.address, endpoint));
  await database().pool.end();
}
