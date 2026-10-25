import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultDashboardSettings, type Dashboard } from "@wuff/contracts";
import { empireDestination, portalSections } from "../apps/web/src/lib/empire";
import { signInReturnPath } from "../apps/web/src/lib/auth/return-path";
import {
  portalDashboardLoader,
  type PortalDashboardState,
} from "../apps/web/src/lib/portal-dashboard";

function dashboard(today = "2026-10-25"): Dashboard {
  return {
    name: "Synthetic pack member",
    today,
    through: "2026-11-01",
    preferences: { version: 0, settings: defaultDashboardSettings },
    todayTasks: [],
    upcomingTasks: [],
    todayTotal: 0,
    upcomingTotal: 0,
    favorites: [],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("Empire routes distinguish apps/account from public guides, auth and prefix lookalikes", () => {
  for (const [path, expected] of [
    ["/", "dashboard"],
    ["/lists", "todo"],
    ["/tasks/WUFF-42", "todo"],
    ["/github", "todo"],
    ["/agents", "todo"],
    ["/connections", "todo"],
    ["/totake", "totake"],
    ["/settings", "account"],
    ["/settings/docs/design", "account"],
    ["/docs", null],
    ["/docs/design", null],
    ["/sign-in", null],
    ["/set-password", null],
    ["/oauth/authorize", null],
    ["/api/mcp", null],
    ["/lists-other", null],
    ["/totakeover", null],
    ["/settings-extra", null],
  ] as const)
    assert.equal(empireDestination(path), expected, path);
});

test("sign-in defaults to Empire and preserves supported direct app and OAuth destinations", () => {
  assert.equal(signInReturnPath(), "/");
  for (const path of [
    "/",
    "/lists",
    "/lists?home=1",
    "/lists?listId=ee3110d4-30a5-408f-8f58-9b8a6c080550",
    "/totake",
    "/settings",
    "/settings/docs",
    "/settings/reminders",
    "/settings/connections",
    "/tasks/WUFF-42",
    "/oauth/authorize?client_id=synthetic",
  ])
    assert.equal(signInReturnPath(path), path);
  for (const path of [
    "//example.com",
    "https://example.com",
    "/\\example.com",
    "/totake/../../sign-out",
    "/totake?next=//example.com",
    "/lists?listId=bad",
    "/lists?home=1&next=//example.com",
    "/tasks/WUFF-42?next=//example.com",
    "/settings-extra",
    "/%2fexample.com",
  ])
    assert.equal(signInReturnPath(path), "/");
});

test("portal previews respect saved Todo section order/visibility without changing preferences", () => {
  const data = dashboard();
  data.preferences.settings = {
    sections: ["favorites", "upcoming", "today"],
    hidden: ["upcoming"],
    startPage: "last_list",
  };
  const before = structuredClone(data);
  assert.deepEqual(portalSections(data), ["favorites", "today"]);
  assert.deepEqual(data, before);
  data.preferences.settings.hidden = ["today", "favorites", "upcoming"];
  assert.deepEqual(portalSections(data), []);
});

test("portal loader publishes loading then authorized empty success using the explicit local date", async () => {
  const states: PortalDashboardState[] = [];
  const data = dashboard();
  const loader = portalDashboardLoader(
    async (today) => {
      assert.equal(today, data.today);
      return data;
    },
    (state) => states.push(state),
  );
  await loader.refresh(data.today);
  assert.deepEqual(states, [
    { status: "loading", data: null },
    { status: "ready", data },
  ]);
});

test("failed refresh clears private previews and explicit retry recovers", async () => {
  const states: PortalDashboardState[] = [];
  let fail = false;
  const data = dashboard();
  const loader = portalDashboardLoader(
    async () => {
      if (fail) throw new Error("Access revoked or network unavailable");
      return data;
    },
    (state) => states.push(state),
  );
  await loader.refresh(data.today);
  fail = true;
  await loader.refresh(data.today);
  assert.deepEqual(states.at(-1), { status: "error", data: null });
  fail = false;
  await loader.refresh(data.today);
  assert.deepEqual(states.at(-1), { status: "ready", data });
});

test("late responses cannot restore revoked previews after a newer failure", async () => {
  const states: PortalDashboardState[] = [];
  const old = deferred<Dashboard>(),
    fresh = deferred<Dashboard>();
  let requests = 0;
  const loader = portalDashboardLoader(
    () => (++requests === 1 ? old.promise : fresh.promise),
    (state) => states.push(state),
  );
  const previous = loader.refresh("2026-10-25");
  const current = loader.refresh("2026-10-25");
  fresh.reject(new Error("Revoked"));
  await current;
  old.resolve(dashboard());
  await previous;
  assert.deepEqual(states.at(-1), { status: "error", data: null });
  assert(!states.some((state) => state.status === "ready"));
});

test("calendar change clears yesterday and ignores old responses or errors", async () => {
  const states: PortalDashboardState[] = [];
  const yesterday = deferred<Dashboard>();
  let requests = 0;
  const loader = portalDashboardLoader(
    async (today) => (++requests === 2 ? yesterday.promise : dashboard(today)),
    (state) => states.push(state),
  );
  await loader.refresh("2026-10-25");
  const old = loader.refresh("2026-10-25");
  const next = loader.refresh("2026-10-26");
  assert.deepEqual(states.at(-1), { status: "loading", data: null });
  await next;
  yesterday.reject(new Error("Old failure"));
  await old;
  assert.equal(states.at(-1)?.data?.today, "2026-10-26");
});

test("disposed account/page loaders cannot publish or read again", async () => {
  const states: PortalDashboardState[] = [];
  const pending = deferred<Dashboard>();
  let reads = 0;
  const loader = portalDashboardLoader(
    () => {
      reads++;
      return pending.promise;
    },
    (state) => states.push(state),
  );
  const request = loader.refresh("2026-10-25");
  loader.dispose();
  pending.resolve(dashboard());
  await request;
  await loader.refresh("2026-10-25");
  assert.equal(reads, 1);
  assert.deepEqual(states, [{ status: "loading", data: null }]);
});
