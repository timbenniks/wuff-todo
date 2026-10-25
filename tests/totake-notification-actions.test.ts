import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  totakeEngine as e,
  totakeMutationSchema,
  type TotakeSnapshot,
} from "@wuff/contracts";
import {
  makeTotakeNotification,
  notificationItemIdentity,
  validateNotificationAction,
  safeNotificationPath,
  totakeReminderPath,
  notificationLink,
  validTotakeGroupId,
} from "@wuff/contracts/modules/totake/notification";
import {
  emptyTotake,
  applyTotakeAction,
} from "../packages/domain/src/modules/totake/state";
import { signInReturnPath } from "../apps/web/src/lib/auth/return-path";
import { notificationWorker } from "./helpers/notification-worker";
function fixture(kind: "medication" | "equipment" = "medication") {
  const now = Date.now(),
    userId = randomUUID(),
    deviceId = randomUUID();
  const setupAt = Math.floor(now / 60000) * 60000;
  let state = emptyTotake(setupAt);
  const treatment = e.newTreatment(
    kind,
    "custom",
    Math.floor(state.now / 1440),
  );
  treatment.name = "Fictional notification item";
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
    setupAt,
  );
  const group = state.groups.find(
    (g) => (g.items[0].alertInstant ?? Infinity) <= now,
  )!;
  assert(group);
  const notice = makeTotakeNotification(
    state,
    group,
    userId,
    deviceId,
    true,
    now,
  );
  const record = {
    action: "record" as const,
    groupId: group.id,
    itemIds: [group.items[0].id],
    outcome: "taken" as const,
  };
  const snapshot: TotakeSnapshot = {
    userId,
    version: 1,
    state,
    delivery: { enabled: true, message: "Synthetic" },
  };
  const path = totakeReminderPath(group.id, userId);
  return {
    now,
    userId,
    deviceId,
    state,
    group,
    notice,
    record,
    snapshot,
    path,
    treatment,
  };
}
test("real calendar/DST occurrence links accept bounded IDs and account pins, rejecting external/ambiguous routes", () => {
  const user = randomUUID();
  for (const id of [
    "0-0",
    "20751-480",
    "20751-150@1792888200000",
    "84000-1439",
  ]) {
    assert(validTotakeGroupId(id));
    for (const snooze of [true, false]) {
      const path = totakeReminderPath(id, user, snooze);
      assert.equal(safeNotificationPath(path), path);
      assert.equal(signInReturnPath(path), path);
    }
  }
  for (const id of [
    "20751-1440",
    "84001-0",
    "-1-4",
    "20751-480@bad",
    "x",
    "20751-480/evil",
  ])
    assert(!validTotakeGroupId(id));
  for (const path of [
    "/totake?reminder=1-1\n",
    "/totake?reminder=1-1\\evil",
    "//evil.test",
    "https://evil.test",
    "/totake?reminder=x",
    "/totake?reminder=1-1&reminder=2-2",
    "/totake?reminder=1-1&redirect=evil",
    "/totake?reminder=1-1#evil",
    "/totake?reminder=1-1&account=bad",
  ]) {
    assert.equal(safeNotificationPath(path), "/settings/notifications");
    assert.equal(signInReturnPath(path), "/");
  }
  assert(notificationLink(`?reminder=1-1&account=${user}`, randomUUID()).error);
  assert.equal(
    notificationLink(`?reminder=1-1&account=${user}&intent=snooze`, user)
      .snooze,
    true,
  );
});
test("only an identified single due item receives direct Taken/Done and snooze context; groups/hidden/future items require review", () => {
  for (const kind of ["medication", "equipment"] as const) {
    const f = fixture(kind);
    assert(f.notice.direct);
    assert.equal(f.notice.kind, kind);
    assert.equal(
      makeTotakeNotification(
        f.state,
        f.group,
        f.userId,
        f.deviceId,
        false,
        f.now,
      ).direct,
      undefined,
    );
    assert(
      !JSON.stringify(
        makeTotakeNotification(
          f.state,
          f.group,
          f.userId,
          f.deviceId,
          false,
          f.now,
        ),
      ).includes(f.treatment.name),
    );
    const future = structuredClone(f.group);
    future.items[0].alertInstant = f.now + 1000;
    assert.equal(
      makeTotakeNotification(f.state, future, f.userId, f.deviceId, true, f.now)
        .direct,
      undefined,
    );
    const grouped = structuredClone(f.group);
    grouped.items.push({ ...grouped.items[0], id: "second-item" });
    assert.equal(
      makeTotakeNotification(
        f.state,
        grouped,
        f.userId,
        f.deviceId,
        true,
        f.now,
      ).direct,
      undefined,
    );
  }
});
test("notification context is strict and lifetime-bounded; existing actions preserve all four snooze durations", () => {
  const f = fixture();
  const input = {
    operationId: randomUUID(),
    version: 1,
    change: f.record,
    notification: f.notice.direct!,
  };
  assert(totakeMutationSchema.safeParse(input).success);
  for (const minutes of [15, 30, 45, 60])
    assert(
      totakeMutationSchema.safeParse({
        ...input,
        change: {
          action: "snooze",
          groupId: f.group.id,
          itemIds: f.record.itemIds,
          minutes,
        },
      }).success,
    );
  for (const minutes of [0, 10, 90])
    assert(
      !totakeMutationSchema.safeParse({
        ...input,
        change: {
          action: "snooze",
          groupId: f.group.id,
          itemIds: f.record.itemIds,
          minutes,
        },
      }).success,
    );
  for (const notification of [
    { ...input.notification, expiresAt: f.now + 3600001 },
    { ...input.notification, issuedAt: -1 },
    { ...input.notification, token: "not allowed" },
    { ...input.notification, deviceId: "bad" },
  ])
    assert(!totakeMutationSchema.safeParse({ ...input, notification }).success);
});
test("stale account/expiry/history, changed selection/dose, future/snoozed/resolved items and skip/undo cannot use direct shortcuts", () => {
  const f = fixture(),
    c = f.notice.direct!;
  validateNotificationAction(f.state, f.record, c, f.userId, f.now);
  for (const context of [
    { ...c, userId: randomUUID() },
    { ...c, expiresAt: f.now },
    { ...c, issuedAt: f.now + 1 },
    { ...c, expiresAt: Infinity },
    { ...c, identity: "changed" },
    { ...c, lastAuditId: "old" },
  ])
    assert.throws(() =>
      validateNotificationAction(f.state, f.record, context, f.userId, f.now),
    );
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      { ...f.record, outcome: "skipped" },
      c,
      f.userId,
      f.now,
    ),
  );
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      { ...f.record, itemIds: [...f.record.itemIds, "second"] },
      c,
      f.userId,
      f.now,
    ),
  );
  for (const change of ["dose", "future", "snooze", "group"] as const) {
    const state = structuredClone(f.state),
      g = state.groups.find((g) => g.id === f.group.id)!;
    if (change === "dose") g.items[0].dose = "changed";
    if (change === "future") g.items[0].alertInstant = f.now + 1000;
    if (change === "snooze")
      g.reminders[g.items[0].id].snoozedInstant = f.now + 1000;
    if (change === "group") g.items.push({ ...g.items[0], id: "second" });
    assert.throws(() =>
      validateNotificationAction(state, f.record, c, f.userId, f.now),
    );
  }
  const saved = applyTotakeAction(f.state, f.record, randomUUID(), f.now);
  assert.throws(() =>
    validateNotificationAction(saved, f.record, c, f.userId, f.now),
  );
  const undo = applyTotakeAction(
    saved,
    {
      action: "undo",
      groupId: f.group.id,
      recordId: saved.groups.find((g) => g.id === f.group.id)!.records[0].id,
    },
    randomUUID(),
    f.now,
  );
  assert.throws(() =>
    validateNotificationAction(undo, f.record, c, f.userId, f.now),
  );
  assert.equal(notificationItemIdentity(f.group, f.group.items[0]), c.identity);
});
function click(data: any, action = "") {
  return { action, notification: { data, tag: "synthetic", close() {} } };
}
function reply(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
test("actual worker limits buttons, uses Taken/Done correctly and gives grouped/private or unsupported browsers a review fallback", async () => {
  for (const kind of ["medication", "equipment"] as const) {
    const f = fixture(kind),
      w = notificationWorker();
    await w.dispatch("push", {
      data: {
        json: () => ({ title: "Synthetic", path: f.path, totake: f.notice }),
      },
    });
    assert.equal(
      w.shown[0][1].actions[0].title,
      kind === "medication" ? "Taken" : "Done",
    );
    assert.equal(w.shown[0][1].actions[1].title, "Snooze 15 min");
    await w.dispatch("notificationclose", click(w.shown[0][1].data));
    assert.equal(w.requests.length, 0);
    const hidden = makeTotakeNotification(
      f.state,
      f.group,
      f.userId,
      f.deviceId,
      false,
      f.now,
    );
    await w.dispatch("push", {
      data: { json: () => ({ path: f.path, totake: hidden }) },
    });
    assert.equal(w.shown.at(-1)[1].actions[0].action, "totake-review");
    await w.dispatch(
      "notificationclick",
      click(w.shown.at(-1)[1].data, "totake-snooze-options"),
    );
    assert(w.opened[0].includes("intent=snooze"));
    assert.equal(w.requests.length, 0);
    const limited = notificationWorker(1);
    await limited.dispatch("push", {
      data: { json: () => ({ path: f.path, totake: f.notice }) },
    });
    assert.equal(limited.shown[0][1].actions.length, 1);
    const unsupported = notificationWorker(0);
    await unsupported.dispatch("push", {
      data: { json: () => ({ path: f.path, totake: f.notice }) },
    });
    assert.equal(unsupported.shown[0][1].actions.length, 0);
    await unsupported.dispatch(
      "notificationclick",
      click(unsupported.shown[0][1].data),
    );
    assert(unsupported.opened[0].includes(encodeURIComponent(f.group.id)));
  }
});
test("worker records via fresh account-pinned API and retries an uncertain committed write identically without double stock deduction", async () => {
  const f = fixture(),
    w = notificationWorker();
  let current = f.snapshot,
    committedBody: string | undefined;
  w.setFetch(async (_url, options) => {
    assert.equal((options.headers as any)["X-Wuff-User"], f.userId);
    assert.equal(options.credentials, "same-origin");
    if (options.method !== "PUT") return reply(current);
    if (committedBody) {
      assert.equal(options.body, committedBody);
      return reply(current);
    }
    committedBody = options.body as string;
    const input = totakeMutationSchema.parse(JSON.parse(committedBody));
    current = {
      ...current,
      version: current.version + 1,
      state: applyTotakeAction(
        current.state,
        input.change,
        input.operationId,
        Date.now(),
      ),
    };
    throw Error("Committed reply was lost");
  });
  await w.dispatch(
    "notificationclick",
    click({ path: f.path, totake: f.notice }, "totake-record"),
  );
  assert.equal(w.requests.filter((r) => r.options.method === "PUT").length, 2);
  assert.equal(current.state.treatments![0].inventory.current, "9");
  assert.equal(
    current.state.groups.find((g) => g.id === f.group.id)!.records.length,
    1,
  );
  assert(w.shown.at(-1)[1].body.startsWith("Recorded."));
  assert.equal(w.opened.length, 0);
});
test("worker snooze preserves stock and original due time and cannot imply completion", async () => {
  const f = fixture(),
    w = notificationWorker();
  let current = f.snapshot;
  w.setFetch(async (_url, options) => {
    if (options.method !== "PUT") return reply(current);
    const input = totakeMutationSchema.parse(
      JSON.parse(options.body as string),
    );
    current = {
      ...current,
      version: current.version + 1,
      state: applyTotakeAction(
        current.state,
        input.change,
        input.operationId,
        Date.now(),
      ),
    };
    return reply(current);
  });
  await w.dispatch(
    "notificationclick",
    click({ path: f.path, totake: f.notice }, "totake-snooze-15"),
  );
  const g = current.state.groups.find((g) => g.id === f.group.id)!;
  assert.equal(g.records.length, 0);
  assert.equal(g.due, f.group.due);
  assert.equal(current.state.treatments![0].inventory.current, "10");
  assert.equal(
    g.reminders[g.items[0].id].snoozedInstant,
    current.state.clock!.instant + 15 * 60000,
  );
  assert.equal(w.shown.at(-1)[1].body, "Snoozed for 15 minutes.");
});
test("worker refuses stale/account-changed/unauthenticated reads without writing; failures and conflicts open review with honest feedback", async () => {
  for (const mode of [
    "account",
    "resolved",
    "unauthorized",
    "offline",
    "conflict",
  ] as const) {
    const f = fixture(),
      w = notificationWorker();
    w.setFetch(async (_url, options) => {
      if (mode === "offline") throw Error("offline");
      if (options.method === "PUT") return reply({ error: {} }, 409);
      if (mode === "unauthorized") return reply({}, 401);
      if (mode === "account")
        return reply({ ...f.snapshot, userId: randomUUID() });
      if (mode === "resolved")
        return reply({
          ...f.snapshot,
          state: applyTotakeAction(f.state, f.record, randomUUID(), f.now),
        });
      return reply(f.snapshot);
    });
    await w.dispatch(
      "notificationclick",
      click({ path: f.path, totake: f.notice }, "totake-record"),
    );
    assert(w.shown.at(-1)[1].body.includes("Couldn’t confirm"));
    assert.equal(w.opened.length, 1);
    assert.equal(
      w.requests.filter((r) => r.options.method === "PUT").length,
      mode === "conflict" ? 1 : 0,
    );
  }
});

test("worker updates activate promptly and old unpinned notifications open only the overview", async () => {
  const w = notificationWorker();
  await w.dispatch("install", {});
  await w.dispatch("activate", {});
  assert.equal(w.lifecycle.skipped, 1);
  assert.equal(w.lifecycle.claimed, 1);
  await w.dispatch(
    "notificationclick",
    click({ path: "/totake?reminder=20751-480" }),
  );
  assert.equal(w.opened[0], "https://wuff.example/totake");
  assert.equal(w.requests.length, 0);
});

test("an expired shortcut does not expire the unresolved medicine occurrence", () => {
  const f = fixture();
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      f.record,
      f.notice.direct!,
      f.userId,
      f.now + 3600001,
    ),
  );
  const saved = applyTotakeAction(
    f.state,
    f.record,
    randomUUID(),
    f.now + 3600001,
  );
  assert.equal(
    saved.groups.find((g) => g.id === f.group.id)!.records.length,
    1,
  );
});

test("revoked OS display permission still opens authoritative review without repeating a successful mutation", async () => {
  for (const accepted of [true, false]) {
    const f = fixture(),
      w = notificationWorker();
    let writes = 0;
    w.failDisplay();
    w.setFetch(async (_url, options) => {
      if (options.method !== "PUT") return reply(f.snapshot);
      writes++;
      return accepted
        ? reply({
            ...f.snapshot,
            version: 2,
            state: applyTotakeAction(
              f.state,
              f.record,
              randomUUID(),
              Date.now(),
            ),
          })
        : reply({}, 409);
    });
    await w.dispatch(
      "notificationclick",
      click({ path: f.path, totake: f.notice }, "totake-record"),
    );
    assert.equal(writes, 1);
    assert.equal(w.opened.length, 1);
  }
});

test("opening Totake preserves an existing editor and focuses an exact reminder window without reloading it", async () => {
  const f = fixture(),
    w = notificationWorker();
  let navigations = 0,
    focused = 0;
  w.clients.matchAll = async () => [
    {
      url: "https://wuff.example/totake",
      navigate: async () => {
        navigations++;
      },
    },
  ];
  await w.dispatch("notificationclick", click({ path: f.path }));
  assert.equal(navigations, 0);
  assert.equal(w.opened.length, 1);
  w.clients.matchAll = async () => [
    {
      url: "https://wuff.example" + f.path,
      focus: async () => {
        focused++;
      },
      navigate: async () => {
        navigations++;
      },
    },
  ];
  await w.dispatch("notificationclick", click({ path: f.path }));
  assert.equal(navigations, 0);
  assert.equal(focused, 1);
  assert.equal(w.opened.length, 1);
});

test("worker retries HTTP 5xx writes identically once and does not report unresolved responses as recorded", async () => {
  for (const mode of ["recover", "failed", "unconfirmed"] as const) {
    const f = fixture(),
      w = notificationWorker();
    const bodies: string[] = [];
    w.setFetch(async (_url, options) => {
      if (options.method !== "PUT") return reply(f.snapshot);
      bodies.push(options.body as string);
      if (mode === "unconfirmed") return reply(f.snapshot);
      if (bodies.length === 1 || mode === "failed") return reply({}, 503);
      const input = totakeMutationSchema.parse(
        JSON.parse(options.body as string),
      );
      return reply({
        ...f.snapshot,
        version: 2,
        state: applyTotakeAction(
          f.state,
          input.change,
          input.operationId,
          Date.now(),
        ),
      });
    });
    await w.dispatch(
      "notificationclick",
      click({ path: f.path, totake: f.notice }, "totake-record"),
    );
    if (mode === "unconfirmed") assert.equal(bodies.length, 1);
    else {
      assert.equal(bodies.length, 2);
      assert.equal(bodies[0], bodies[1]);
    }
    assert.equal(
      w.shown.at(-1)[1].body.startsWith("Recorded."),
      mode === "recover",
    );
    assert.equal(w.opened.length, mode === "recover" ? 0 : 1);
  }
});

test("delayed pushes with expired contexts offer review instead of an expired direct Taken action", async () => {
  const f = fixture(),
    w = notificationWorker();
  const expired = {
    ...f.notice,
    direct: {
      ...f.notice.direct!,
      issuedAt: f.now - 7200000,
      expiresAt: f.now - 3600000,
    },
  };
  await w.dispatch("push", {
    data: { json: () => ({ path: f.path, totake: expired }) },
  });
  assert.equal(w.shown[0][1].actions[0].action, "totake-review");
  assert.equal(w.requests.length, 0);
});
