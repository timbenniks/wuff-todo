import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { totakeEngine as e, totakeMutationSchema } from "@wuff/contracts";
import {
  makeTotakeNotification,
  validateNotificationAction,
} from "@wuff/contracts/modules/totake/notification";
import {
  emptyTotake,
  applyTotakeAction,
} from "../packages/domain/src/modules/totake/state";
import { notificationWorker } from "./helpers/notification-worker";
function fixture() {
  const now = Math.floor(Date.now() / 60000) * 60000;
  let state = emptyTotake(now);
  for (let n = 0; n < 2; n++) {
    const t = e.newTreatment(
      "medication",
      "custom",
      Math.floor(state.now / 1440),
    );
    t.name = `Fictional group item ${n + 1}`;
    t.slots[0].time = e.time(state.now);
    t.inventory = {
      enabled: true,
      current: "10",
      threshold: "1",
      unit: "tablet",
    };
    state = applyTotakeAction(
      state,
      { action: "save_treatment", draft: t },
      randomUUID(),
      now,
    );
  }
  const group = state.groups.find(
    (g) => g.items.length === 2 && g.items[0].alertInstant === now,
  )!;
  assert(group);
  const userId = randomUUID(),
    deviceId = randomUUID();
  const notice = makeTotakeNotification(
    state,
    group,
    userId,
    deviceId,
    true,
    now,
  );
  return { now, state, group, userId, deviceId, notice };
}
test("a due group offers an exact notification selection for direct confirmation", () => {
  const f = fixture();
  assert.equal(f.notice.direct?.items?.length, 2);
});

test("notification payload count/time uses scheduled timezone and privacy hides medicine details", async () => {
  const { totakeNotificationContent } =
    await import("@wuff/contracts/modules/totake/notification");
  const f = fixture();
  const visible = totakeNotificationContent(f.state, f.group, true, f.now);
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: f.state.clock!.zone,
  }).format(new Date(f.now));
  assert.equal(visible.title, `2 reminders at ${clock}`);
  assert(visible.body.includes(f.group.items[0].name));
  assert(visible.body.includes(f.group.items[0].dose));
  const privatePayload = totakeNotificationContent(
    f.state,
    f.group,
    false,
    f.now,
  );
  assert.equal(privatePayload.title, visible.title);
  assert.equal(privatePayload.body, "Open Wuff to view your reminder.");
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
    ).includes(f.group.items[0].name),
  );
  const snoozed = structuredClone(f.group);
  snoozed.reminders[snoozed.items[1].id].snoozedInstant = f.now + 30000;
  snoozed.reminders[snoozed.items[1].id].nextInstant = f.now + 30000;
  assert.match(
    totakeNotificationContent(f.state, snoozed, true, f.now).title,
    /^1 reminder at /,
  );
  assert(
    !totakeNotificationContent(f.state, snoozed, true, f.now).body.includes(
      snoozed.items[1].name,
    ),
  );
});

test("group context accepts exact confirm/skip/30-minute snooze; subset, duplicate, other duration and stale selections require review", () => {
  const f = fixture(),
    context = f.notice.direct!;
  const ids = context.items!.map((i) => i.itemId);
  const record = {
    action: "record" as const,
    groupId: f.group.id,
    itemIds: ids,
    outcome: "taken" as const,
  };
  for (const change of [
    record,
    { ...record, outcome: "skipped" as const },
    {
      action: "snooze" as const,
      groupId: f.group.id,
      itemIds: ids,
      minutes: 30 as const,
    },
  ]) {
    assert.doesNotThrow(() =>
      validateNotificationAction(f.state, change, context, f.userId, f.now),
    );
    assert(
      totakeMutationSchema.safeParse({
        operationId: randomUUID(),
        version: 1,
        notification: context,
        change,
      }).success,
    );
  }
  for (const itemIds of [[ids[0]], [ids[0], ids[0]], [...ids, "new-item"]])
    assert.throws(() =>
      validateNotificationAction(
        f.state,
        { ...record, itemIds },
        context,
        f.userId,
        f.now,
      ),
    );
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      { action: "snooze", groupId: f.group.id, itemIds: ids, minutes: 15 },
      context,
      f.userId,
      f.now,
    ),
  );
  assert.throws(() =>
    validateNotificationAction(f.state, record, context, randomUUID(), f.now),
  );
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      record,
      context,
      f.userId,
      context.expiresAt,
    ),
  );
  assert.throws(() =>
    validateNotificationAction(
      f.state,
      record,
      { ...context, identity: "changed" },
      f.userId,
      f.now,
    ),
  );
  assert(
    !totakeMutationSchema.safeParse({
      operationId: randomUUID(),
      version: 1,
      notification: {
        ...context,
        items: [context.items![0], context.items![0]],
      },
      change: record,
    }).success,
  );
  for (const update of [
    "identity",
    "resolved",
    "snoozed",
    "history",
    "new-due",
  ] as const) {
    const state = structuredClone(f.state),
      group = state.groups.find((g) => g.id === f.group.id)!;
    if (update === "identity") group.items[0].dose = "changed";
    if (update === "resolved")
      group.records.push({
        id: randomUUID(),
        itemId: ids[0],
        outcome: "taken",
        at: state.now,
      });
    if (update === "snoozed")
      group.reminders[ids[0]].snoozedInstant = f.now + 60000;
    if (update === "history")
      state.audit.push({
        id: randomUUID(),
        groupId: group.id,
        itemId: ids[0],
      } as any);
    if (update === "new-due")
      group.items.push({ ...group.items[0], id: "newly-due" });
    assert.throws(
      () => validateNotificationAction(state, record, context, f.userId, f.now),
      update,
    );
  }
  // The callback moves the next repeat forward after sending; it must not disable its own action.
  const advanced = structuredClone(f.state);
  for (const id of ids)
    advanced.groups.find((g) => g.id === f.group.id)!.reminders[
      id
    ].nextInstant = f.now + 15 * 60000;
  assert.doesNotThrow(() =>
    validateNotificationAction(
      advanced,
      record,
      context,
      f.userId,
      f.now + 1000,
    ),
  );
});

const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function pushGroup(
  w: ReturnType<typeof notificationWorker>,
  f: ReturnType<typeof fixture>,
) {
  const { totakeReminderPath } =
    await import("@wuff/contracts/modules/totake/notification");
  await w.dispatch("push", {
    data: {
      json: () => ({
        title: "2 reminders",
        path: totakeReminderPath(f.group.id, f.userId),
        totake: f.notice,
      }),
    },
  });
  return w.shown[0][1].data;
}
function click(data: any, action: string) {
  return {
    action,
    notification: { data, tag: "fictional-group", close: () => {} },
  };
}

test("actual worker respects 0/1/2/3 button limits and private/expired review fallbacks", async () => {
  const f = fixture();
  for (const max of [0, 1, 2, 3]) {
    const w = notificationWorker(max);
    await pushGroup(w, f);
    assert.deepEqual(
      Array.from(w.shown[0][1].actions, (a: any) => a.title),
      ["Confirm all", "30 min later", "Skip all"].slice(0, max),
    );
  }
  const w = notificationWorker(3);
  await pushGroup(w, {
    ...f,
    notice: makeTotakeNotification(
      f.state,
      f.group,
      f.userId,
      f.deviceId,
      false,
      f.now,
    ),
  });
  assert.deepEqual(
    Array.from(w.shown[0][1].actions, (a: any) => a.title),
    ["Review items", "Snooze…"],
  );
  const expired = structuredClone(f.notice);
  expired.direct!.expiresAt = f.now - 1;
  const x = notificationWorker(3);
  await pushGroup(x, { ...f, notice: expired });
  assert.equal(x.shown[0][1].actions[0].title, "Review items");
});

test("actual grouped worker confirms once after a lost committed response and validates complete receipt readback", async () => {
  const f = fixture(),
    w = notificationWorker();
  const data = await pushGroup(w, f);
  let state = f.state,
    writes = 0;
  const bodies: string[] = [];
  w.setFetch(async (_url, options) => {
    if (options.method !== "PUT")
      return reply({ userId: f.userId, version: 1, state });
    bodies.push(options.body as string);
    writes++;
    const input = JSON.parse(options.body as string);
    assert.deepEqual(
      input.change.itemIds,
      f.group.items.map((i) => i.id),
    );
    if (writes === 1) {
      state = applyTotakeAction(
        state,
        input.change,
        input.operationId,
        Date.now(),
      );
      throw Error("Lost committed reply");
    }
    return reply({ userId: f.userId, version: 2, state });
  });
  await w.dispatch("notificationclick", click(data, "totake-group-record"));
  assert.equal(writes, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(
    state.groups.find((g) => g.id === f.group.id)!.records.length,
    2,
  );
  assert.deepEqual(
    state.treatments!.map((t) => t.inventory.current),
    ["9", "9"],
  );
  assert.match(w.shown.at(-1)[1].body, /Recorded/);
  assert.equal(w.opened.length, 0);
});

test("group snooze and skip preserve stock; partial or stale results never report success", async () => {
  for (const action of ["totake-group-snooze-30", "totake-group-skip"]) {
    const f = fixture(),
      w = notificationWorker(3),
      data = await pushGroup(w, f);
    let saved = f.state;
    w.setFetch(async (_url, options) => {
      if (options.method !== "PUT")
        return reply({ userId: f.userId, version: 1, state: f.state });
      const input = JSON.parse(options.body as string);
      if (action.includes("snooze")) assert.equal(input.change.minutes, 30);
      saved = applyTotakeAction(
        f.state,
        input.change,
        input.operationId,
        f.now + 1000,
      );
      return reply({ userId: f.userId, version: 2, state: saved });
    });
    await w.dispatch("notificationclick", click(data, action));
    assert.deepEqual(
      saved.treatments!.map((t) => t.inventory.current),
      ["10", "10"],
    );
    const group = saved.groups.find((g) => g.id === f.group.id)!;
    if (action.includes("snooze"))
      assert(
        group.items.every(
          (i) =>
            group.reminders[i.id].snoozedInstant === f.now + 1000 + 30 * 60000,
        ),
      );
    else assert(group.records.every((r) => r.outcome === "skipped"));
  }
  for (const mode of ["partial", "stale", "account"] as const) {
    const f = fixture(),
      w = notificationWorker(),
      data = await pushGroup(w, f);
    let writes = 0;
    const state = structuredClone(f.state);
    if (mode === "stale")
      state.groups.find((g) => g.id === f.group.id)!.items[0].dose = "changed";
    w.setFetch(async (_url, options) => {
      if (options.method !== "PUT")
        return reply({
          userId: mode === "account" ? randomUUID() : f.userId,
          version: 1,
          state,
        });
      writes++;
      const partial = applyTotakeAction(
        f.state,
        {
          action: "record",
          groupId: f.group.id,
          itemIds: [f.group.items[0].id],
          outcome: "taken",
        },
        randomUUID(),
        f.now,
      );
      return reply({ userId: f.userId, version: 2, state: partial });
    });
    await w.dispatch("notificationclick", click(data, "totake-group-record"));
    assert.equal(writes, mode === "partial" ? 1 : 0);
    assert.match(w.shown.at(-1)[1].body, /Couldn’t confirm/);
    assert.equal(w.opened.length, 1);
  }
});

test("large Unicode group payloads fall back to review within Web Push limits without altering the source context", async () => {
  const {
    fitTotakePushPayload,
    totakeNotificationContent,
    totakeReminderPath,
  } = await import("@wuff/contracts/modules/totake/notification");
  const f = fixture();
  const ordinary = {
    ...totakeNotificationContent(f.state, f.group, true, f.now),
    path: totakeReminderPath(f.group.id, f.userId),
    tag: "fictional",
    totake: f.notice,
  };
  assert(fitTotakePushPayload(ordinary).totake.direct);
  const large = {
    ...ordinary,
    body: "💊".repeat(2000),
    totake: {
      ...f.notice,
      direct: { ...f.notice.direct!, identity: "界".repeat(4000) },
    },
  };
  const original = JSON.stringify(large);
  const fitted = fitTotakePushPayload(large);
  assert(new TextEncoder().encode(JSON.stringify(fitted)).length <= 3500);
  assert.equal(fitted.totake.direct, undefined);
  assert.equal(JSON.stringify(large), original);
  assert.equal(fitted.path, ordinary.path);
  assert.equal(fitted.tag, ordinary.tag);
});
