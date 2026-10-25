import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { reminderDeviceSchema } from "@wuff/contracts";
import {
  browserPushSupport,
  enableBrowserPush,
  currentBrowserSubscription,
  unsubscribeBrowserPush,
} from "../apps/web/src/lib/browser-push";
import { disableBrowserOnSignOut } from "../apps/web/src/lib/reminder-browser";
const endpoint = "https://fcm.googleapis.com/fcm/send/synthetic";
const key = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]);
test("standard browser subscription serialization accepts null/finite expiry and rejects mismatched/malformed endpoints and keys", () => {
  const input = {
    operationId: crypto.randomUUID(),
    label: "Browser",
    transport: "web",
    address: endpoint,
    subscription: {
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: key.toString("base64url"),
        auth: Buffer.alloc(16, 1).toString("base64url"),
      },
    },
  };
  assert.equal(reminderDeviceSchema.safeParse(input).success, true);
  for (const expirationTime of [undefined, 0, Date.now() + 3600000])
    assert.equal(
      reminderDeviceSchema.safeParse({
        ...input,
        subscription: { ...input.subscription, expirationTime },
      }).success,
      true,
    );
  for (const expirationTime of [-1, Infinity, "tomorrow"])
    assert.equal(
      reminderDeviceSchema.safeParse({
        ...input,
        subscription: { ...input.subscription, expirationTime },
      }).success,
      false,
    );
  assert.equal(
    reminderDeviceSchema.safeParse({ ...input, address: endpoint + "-other" })
      .success,
    false,
  );
  assert.equal(
    reminderDeviceSchema.safeParse({
      ...input,
      subscription: {
        ...input.subscription,
        keys: { p256dh: "invalid", auth: "invalid" },
      },
    }).success,
    false,
  );
});
function browserFixture() {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const calls: string[] = [];
  let permission = "granted",
    subscribed = false,
    unsubscribeOk = true;
  const subscription = {
    endpoint,
    options: {
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.length,
      ),
    },
    unsubscribe: async () => {
      calls.push("unsubscribe");
      if (unsubscribeOk) subscribed = false;
      return unsubscribeOk;
    },
  };
  const registration = {
    pushManager: {
      getSubscription: async () => (subscribed ? subscription : null),
      subscribe: async (options: any) => {
        calls.push("subscribe");
        assert.equal(options.userVisibleOnly, true);
        assert.deepEqual(Buffer.from(options.applicationServerKey), key);
        subscribed = true;
        return subscription;
      },
    },
  };
  const worker = {
    getRegistration: async (path: string) => {
      assert.equal(path, "/reminder-worker.js");
      return registration;
    },
    register: async () => {
      calls.push("register");
      return registration;
    },
    ready: Promise.resolve(registration),
  };
  for (const [name, value] of Object.entries({
    window: { isSecureContext: true, Notification: {}, PushManager: {} },
    navigator: { serviceWorker: worker },
    Notification: {
      requestPermission: () => {
        calls.push("permission");
        return Promise.resolve(permission);
      },
    },
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  return {
    calls,
    subscription,
    worker,
    setPermission: (value: string) => {
      permission = value;
    },
    setUnsubscribe: (value: boolean) => {
      unsubscribeOk = value;
    },
    restore: () => {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}
test("browser enable requests permission first, subscribes once, reconnects, then unsubscribes", async () => {
  const f = browserFixture();
  try {
    assert.equal(browserPushSupport(), true);
    assert.equal(await currentBrowserSubscription(), null);
    assert.equal(
      await enableBrowserPush(key.toString("base64url")),
      f.subscription,
    );
    assert.deepEqual(f.calls, ["permission", "register", "subscribe"]);
    await enableBrowserPush(key.toString("base64url"));
    assert.equal(f.calls.filter((c) => c === "subscribe").length, 1);
    f.setUnsubscribe(false);
    await assert.rejects(unsubscribeBrowserPush(), /could not turn off/);
    assert.equal(await currentBrowserSubscription(), f.subscription);
    f.setUnsubscribe(true);
    assert.equal(await unsubscribeBrowserPush(), endpoint);
    assert.equal(await currentBrowserSubscription(), null);
    assert.equal(await unsubscribeBrowserPush(), null);
  } finally {
    f.restore();
  }
});
test("denied/dismissed/unsupported browser never registers and changed VAPID key requires explicit disconnect", async () => {
  const f = browserFixture();
  try {
    f.setPermission("denied");
    await assert.rejects(
      enableBrowserPush(key.toString("base64url")),
      /blocked/,
    );
    f.setPermission("default");
    await assert.rejects(
      enableBrowserPush(key.toString("base64url")),
      /wasn’t granted/,
    );
    assert.deepEqual(f.calls, ["permission", "permission"]);
    f.setPermission("granted");
    await assert.rejects(enableBrowserPush("bad"), /setup is invalid/);
    await enableBrowserPush(key.toString("base64url"));
    await assert.rejects(
      enableBrowserPush(
        Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 2)]).toString(
          "base64url",
        ),
      ),
      /older notification key/,
    );
    assert(!f.calls.includes("unsubscribe"));
    Reflect.deleteProperty(window, "PushManager");
    assert.equal(browserPushSupport(), false);
    await assert.rejects(
      enableBrowserPush(key.toString("base64url")),
      /Home Screen/,
    );
  } finally {
    f.restore();
  }
});
test("worker startup failure is surfaced without subscribing", async () => {
  const f = browserFixture();
  try {
    f.worker.register = async () => {
      throw Error("worker unavailable");
    };
    await assert.rejects(
      enableBrowserPush(key.toString("base64url")),
      /worker unavailable/,
    );
    assert.equal(await currentBrowserSubscription(), null);
    assert(!f.calls.includes("subscribe"));
  } finally {
    f.restore();
  }
});
test("signout unsubscribes before server cleanup even when the cleanup fails", async () => {
  const f = browserFixture(),
    originalFetch = globalThis.fetch;
  try {
    await enableBrowserPush(key.toString("base64url"));
    globalThis.fetch = async (_url, options) => {
      assert.equal(await currentBrowserSubscription(), null);
      assert.equal(
        JSON.parse(options!.body as string).input.endpoint,
        endpoint,
      );
      throw Error("offline");
    };
    await disableBrowserOnSignOut();
    assert.equal(await currentBrowserSubscription(), null);
  } finally {
    globalThis.fetch = originalFetch;
    f.restore();
  }
});
function workerFixture() {
  const handlers: Record<string, (event: any) => void> = {},
    shown: any[] = [],
    opened: string[] = [];
  const clients = {
    matchAll: async () => [] as any[],
    openWindow: async (url: string) => {
      opened.push(url);
    },
  };
  runInNewContext(
    readFileSync(
      new URL("../apps/web/public/reminder-worker.js", import.meta.url),
      "utf8",
    ),
    {
      self: {
        addEventListener: (name: string, handler: any) => {
          handlers[name] = handler;
        },
        registration: {
          showNotification: async (...args: any[]) => {
            shown.push(args);
          },
        },
        location: { origin: "https://wuff.example" },
      },
      clients,
      URL,
    },
  );
  return {
    handlers,
    shown,
    opened,
    clients,
    dispatch: async (name: string, event: any) => {
      let pending: Promise<any> | undefined;
      handlers[name]({
        ...event,
        waitUntil: (p: Promise<any>) => {
          pending = p;
        },
      });
      await pending;
    },
  };
}
test("push worker shows Todo/Totake content and safe visible fallbacks for invalid payloads", async () => {
  const f = workerFixture(),
    id = crypto.randomUUID();
  for (const path of [
    "/lists",
    `/tasks/${id}`,
    "/totake",
    `/totake?reminder=${id}`,
  ]) {
    await f.dispatch("push", {
      data: {
        json: () => ({
          title: "Synthetic reminder",
          body: "Open Wuff",
          path,
          tag: "synthetic",
        }),
      },
    });
    assert.equal(f.shown.at(-1)[1].data.path, path);
    assert.equal(f.shown.at(-1)[0], "Synthetic reminder");
  }
  for (const payload of [
    null,
    [],
    "bad",
    { path: "https://evil.test" },
    { path: "//evil.test" },
    { path: "/totake?reminder=bad&redirect=evil" },
  ]) {
    await f.dispatch("push", { data: { json: () => payload } });
    assert.equal(f.shown.at(-1)[1].data.path, "/settings/notifications");
  }
  await f.dispatch("push", {
    data: {
      json: () => {
        throw Error("malformed");
      },
    },
  });
  assert.equal(f.shown.at(-1)[0], "Wuff reminder");
  assert.equal(f.shown.at(-1)[1].body, "Open Wuff to view your reminder.");
});
test("notification clicks revalidate paths, reuse same-origin clients and recover closing windows", async () => {
  const f = workerFixture();
  let closed = 0,
    focused = 0,
    navigated = "";
  const notification = (path: string) => ({
    data: { path },
    close: () => {
      closed++;
    },
  });
  f.clients.matchAll = async () => [
    {
      url: "https://evil.test",
      navigate: () => {
        throw Error("must skip");
      },
    },
    {
      url: "https://wuff.example/lists",
      navigate: async (url: string) => {
        navigated = url;
        return {
          focus: async () => {
            focused++;
          },
        };
      },
    },
  ];
  await f.dispatch("notificationclick", {
    notification: notification("/totake"),
  });
  assert.equal(navigated, "https://wuff.example/totake");
  assert.equal(focused, 1);
  assert.equal(f.opened.length, 0);
  f.clients.matchAll = async () => [
    {
      url: "https://wuff.example/lists",
      navigate: async () => {
        throw Error("closed");
      },
    },
  ];
  await f.dispatch("notificationclick", {
    notification: notification("https://evil.test/phishing"),
  });
  assert.equal(f.opened.at(-1), "https://wuff.example/settings/notifications");
  assert.equal(closed, 2);
});
