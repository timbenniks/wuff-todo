import assert from "node:assert/strict";
import { test } from "node:test";
import { empireAppCatalog, type EmpireSettings } from "@wuff/contracts";
import {
  clearAfterEmpireSignOut,
  createEmpirePreferencesStore,
} from "../apps/web/src/lib/empire-preferences-store";

const settings = (version = 1, userId = "one"): EmpireSettings => ({
  userId,
  version,
  apps: { todo: { visible: true, dashboard: true } },
  catalog: empireAppCatalog,
});
test("successful sign-out clears names/choices; failed or uncertain sign-out retains the current account", async () => {
  for (const outcome of ["success", "rejected", "network"]) {
    const store = createEmpirePreferencesStore(
      { userId: "one", name: "Alex", settings: settings() },
      async () => settings(),
    );
    const run = () =>
      clearAfterEmpireSignOut(async () => {
        if (outcome === "network") throw Error("offline");
        return outcome === "rejected" ? { error: { message: "denied" } } : {};
      }, store.clear);
    if (outcome === "success") {
      await run();
      assert.equal(store.getSnapshot().settings, null);
      assert.equal(store.getSnapshot().name, "");
    } else {
      await assert.rejects(run);
      assert.equal(store.getSnapshot().name, "Alex");
      assert.ok(store.getSnapshot().settings);
    }
  }
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("server-seeded name and menu are available before any request", () => {
  let reads = 0;
  const first = settings();
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Fictional Alex", settings: first },
    async () => {
      reads++;
      return first;
    },
  );
  assert.equal(store.getSnapshot().settings, first);
  assert.equal(store.getSnapshot().name, "Fictional Alex");
  assert.equal(reads, 0);
  assert.equal(store.register("one"), false);
});
test("pending refresh never blanks the current name or app choices", async () => {
  const response = deferred<EmpireSettings>();
  const first = settings();
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Alex", settings: first },
    () => response.promise,
  );
  const observed: (EmpireSettings | null)[] = [];
  store.subscribe(() => observed.push(store.getSnapshot().settings));
  const request = store.refresh();
  assert.equal(store.getSnapshot().settings, first);
  assert.equal(store.getSnapshot().name, "Alex");
  response.resolve(settings(2));
  await request;
  assert.equal(store.getSnapshot().settings?.version, 2);
  assert.ok(observed.every(Boolean));
});
test("an acknowledged preference save beats a delayed read and late failure", async () => {
  for (const fail of [false, true]) {
    const response = deferred<EmpireSettings>();
    const store = createEmpirePreferencesStore(
      { userId: "one", name: "Alex", settings: settings() },
      () => response.promise,
    );
    const request = store.refresh();
    store.accept(settings(3));
    if (fail) response.reject(new Error("offline"));
    else response.resolve(settings(2));
    await request;
    assert.equal(store.getSnapshot().settings?.version, 3);
    assert.equal(store.getSnapshot().error, "");
    store.accept(settings(1));
    assert.equal(store.getSnapshot().settings?.version, 3);
  }
});
test("overlapping refreshes accept only the latest request", async () => {
  const first = deferred<EmpireSettings>(),
    second = deferred<EmpireSettings>();
  let calls = 0;
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Alex", settings: settings() },
    () => (++calls === 1 ? first.promise : second.promise),
  );
  const a = store.refresh(),
    b = store.refresh();
  second.resolve(settings(2));
  await b;
  first.resolve(settings(3));
  await a;
  assert.equal(store.getSnapshot().settings?.version, 2);
});
test("network failures retain usable choices, while auth/admission/account denial clears identity", async () => {
  for (const status of [undefined, 503, 401, 403, 409]) {
    const store = createEmpirePreferencesStore(
      { userId: "one", name: "Alex", settings: settings() },
      async () => {
        throw { status };
      },
    );
    await store.refresh();
    const denied = status !== undefined && [401, 403, 409].includes(status);
    assert.equal(store.getSnapshot().settings === null, denied);
    assert.equal(store.getSnapshot().name, denied ? "" : "Alex");
    assert.ok(store.getSnapshot().error);
  }
});
test("account switches and sign-out invalidate in-flight results without adopting another account", async () => {
  for (const signOut of [true, false]) {
    const response = deferred<EmpireSettings>();
    const store = createEmpirePreferencesStore(
      { userId: "one", name: "Alex", settings: settings() },
      () => response.promise,
    );
    const request = store.refresh();
    if (signOut) store.clear();
    else assert.equal(store.register("two"), true);
    response.resolve(settings(5));
    await request;
    store.accept(settings(6, "two"));
    assert.equal(store.getSnapshot().settings, null);
    assert.equal(store.getSnapshot().name, "");
    assert.equal(store.getSnapshot().userId, "");
  }
});
test("a cross-account read response cannot expose the other account's choices", async () => {
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Alex", settings: settings() },
    async () => settings(1, "two"),
  );
  store.accept(settings(10, "two"));
  assert.equal(store.getSnapshot().settings?.userId, "one");
  await store.refresh();
  assert.equal(store.getSnapshot().settings, null);
  assert.equal(store.getSnapshot().name, "");
});
test("a failed initial preferences read can recover without changing the server-seeded name", async () => {
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Alex", settings: null },
    async () => settings(),
  );
  assert.equal(store.getSnapshot().name, "Alex");
  await store.refresh();
  assert.equal(store.getSnapshot().settings?.userId, "one");
});
test("cancelling a lifecycle read permits a fresh read and unsubscribe stops notifications", async () => {
  const response = deferred<EmpireSettings>();
  let calls = 0;
  const store = createEmpirePreferencesStore(
    { userId: "one", name: "Alex", settings: settings() },
    () => (++calls === 1 ? response.promise : Promise.resolve(settings(2))),
  );
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  const old = store.refresh();
  store.cancelPending();
  await store.refresh();
  response.resolve(settings(5));
  await old;
  assert.equal(store.getSnapshot().settings?.version, 2);
  assert.equal(notifications, 1);
  unsubscribe();
  store.clear();
  assert.equal(notifications, 1);
});
