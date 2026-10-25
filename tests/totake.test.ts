import {
  acceptTotakeRead,
  createTotakeReadGate,
} from "../packages/ui/src/features/totake/request";
import { notificationDeliveryPolicy } from "../packages/domain/src/notification-policy";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { totakeEngine as e, totakeMutationSchema } from "@wuff/contracts";
import {
  emptyTotake,
  refreshTotake,
  applyTotakeAction,
} from "../packages/domain/src/totake-state";
const now = Date.parse("2026-10-25T06:00:00Z");
function fixture() {
  let s = emptyTotake(now, "Europe/Paris");
  const t = e.newTreatment("medication", "custom", Math.floor(s.now / 1440));
  t.name = "Fictional count medicine";
  t.slots[0].time = "09:00";
  t.inventory = {
    enabled: true,
    current: "10",
    threshold: "2",
    unit: "tablet",
  };
  s = applyTotakeAction(
    s,
    { action: "save_treatment", draft: t },
    randomUUID(),
    now,
  );
  return { s, t };
}
function record() {
  const { s, t } = fixture(),
    g = s.groups[0],
    at = g.items[0].alertInstant!;
  return {
    s: applyTotakeAction(
      s,
      {
        action: "record",
        groupId: g.id,
        itemIds: [g.items[0].id],
        outcome: "taken",
      },
      randomUUID(),
      at,
    ),
    t,
    g,
    at,
  };
}
test("Totake starts with no sample data and uses a server clock", () => {
  const s = emptyTotake(now);
  assert.equal(s.groups.length, 0);
  assert.deepEqual(s.treatments, []);
  assert.equal(s.clock!.instant, now);
});
test("schedule creates stable independent occurrences and no backfill", () => {
  const { s } = fixture();
  assert.ok(s.groups.length > 1);
  assert.notEqual(s.groups[0].items[0].id, s.groups[1].items[0].id);
  assert.ok(
    s.groups.every((g) => g.items.every((i) => i.alertInstant! >= now)),
  );
  const next = refreshTotake(s, now + 1000);
  assert.equal(next.groups[0].items[0].id, s.groups[0].items[0].id);
});
test("recording deducts once, preserves another dose and Undo restores original quantity", () => {
  const { s, t, g, at } = record();
  assert.equal(s.treatments![0].inventory.current, "9");
  assert.equal(e.pending(s.groups.find((x) => x.id === g.id)!).length, 0);
  assert.equal(e.pending(s.groups[1]).length, 1);
  const draft = {
    ...s.treatments![0],
    groupIntervals: {},
    groupEdits: {},
    slots: s.treatments![0].slots.map((slot) => ({ ...slot, quantity: "2" })),
  };
  const edited = applyTotakeAction(
    s,
    { action: "save_treatment", draft },
    randomUUID(),
    at + 1000,
  );
  const r = edited.groups.find((x) => x.id === g.id)!.records[0];
  const undone = applyTotakeAction(
    edited,
    { action: "undo", groupId: g.id, recordId: r.id },
    randomUUID(),
    at + 2000,
  );
  assert.equal(
    undone.treatments!.find((x) => x.id === t.id)!.inventory.current,
    "10",
  );
  assert.equal(
    undone.stock!.movements.filter((m) => m.kind === "undo").length,
    1,
  );
  assert.throws(() =>
    applyTotakeAction(
      undone,
      { action: "undo", groupId: g.id, recordId: r.id },
      randomUUID(),
      at + 3000,
    ),
  );
});
test("zero/duplicate selection is rejected by contracts; stale resolved item cannot record again", () => {
  const { s, g, at } = record();
  assert.throws(() =>
    totakeMutationSchema.parse({
      operationId: randomUUID(),
      version: 0,
      change: {
        action: "record",
        groupId: g.id,
        itemIds: [],
        outcome: "taken",
      },
    }),
  );
  assert.throws(() =>
    applyTotakeAction(
      s,
      {
        action: "record",
        groupId: g.id,
        itemIds: [g.items[0].id],
        outcome: "taken",
      },
      randomUUID(),
      at,
    ),
  );
});
test("Skip and Snooze do not consume stock or shift the schedule", () => {
  const { s } = fixture(),
    g = s.groups[0],
    ids = [g.items[0].id],
    at = g.items[0].alertInstant!;
  const paused = applyTotakeAction(
    s,
    { action: "snooze", groupId: g.id, itemIds: ids, minutes: 45 },
    randomUUID(),
    at,
  );
  const next = paused.groups.find((x) => x.id === g.id)!;
  assert.equal(next.items[0].alertInstant, g.items[0].alertInstant);
  assert.equal(next.reminders[ids[0]].nextInstant, at + 45 * 60000);
  assert.equal(paused.treatments![0].inventory.current, "10");
  const skipped = applyTotakeAction(
    paused,
    { action: "record", groupId: g.id, itemIds: ids, outcome: "skipped" },
    randomUUID(),
    at + 1000,
  );
  assert.equal(skipped.treatments![0].inventory.current, "10");
});
test("liquid and drop stock rejected while fractional counted tablets work", () => {
  const { s, t } = fixture();
  for (const form of ["Liquid", "Drops"])
    assert.throws(
      () =>
        applyTotakeAction(
          s,
          { action: "save_treatment", draft: { ...t, form } },
          randomUUID(),
          now,
        ),
      /counted units/,
    );
  const half = applyTotakeAction(
    s,
    {
      action: "save_treatment",
      draft: { ...t, slots: t.slots.map((x) => ({ ...x, quantity: "0.5" })) },
    },
    randomUUID(),
    now,
  );
  const g = half.groups[0];
  const taken = applyTotakeAction(
    half,
    {
      action: "record",
      groupId: g.id,
      itemIds: [g.items[0].id],
      outcome: "taken",
    },
    randomUUID(),
    g.items[0].alertInstant!,
  );
  assert.equal(taken.treatments![0].inventory.current, "9.5");
});
test("stock Add and Correct retain distinct ledger movements", () => {
  let { s, t } = fixture();
  s = applyTotakeAction(
    s,
    { action: "adjust_stock", treatmentId: t.id, kind: "add", quantity: "3" },
    randomUUID(),
    now,
  );
  assert.equal(s.treatments![0].inventory.current, "13");
  s = applyTotakeAction(
    s,
    {
      action: "adjust_stock",
      treatmentId: t.id,
      kind: "correct",
      quantity: "7",
    },
    randomUUID(),
    now,
  );
  assert.equal(s.treatments![0].inventory.current, "7");
  assert.equal(s.stock!.movements.at(-1)!.delta, -6);
});
test("as-needed intake creates no scheduled reminder; Undo retains registration", () => {
  let s = emptyTotake(now);
  const d = e.newIntake(s);
  d.medication.name = "Fictional as-needed";
  s = applyTotakeAction(s, { action: "record_intake", draft: d }, d.id, now);
  assert.equal(s.groups.length, 0);
  assert.equal(s.intakes!.length, 1);
  s = applyTotakeAction(
    s,
    { action: "undo_intake", intakeId: d.id },
    randomUUID(),
    now + 1000,
  );
  assert.equal(s.intakes![0].undone, true);
  assert.equal(s.treatments!.length, 1);
  assert.equal(s.groups.length, 0);
});
test("DST gap resolves once after gap, fixed fold chooses earlier instant", () => {
  const wall = (iso: string) => Math.floor(Date.parse(iso + "Z") / 60000);
  const gap = e.resolveWall(wall("2026-03-29T02:30:00"), "Europe/Paris");
  assert.equal(gap.gap, true);
  assert.equal(new Date(gap.instant).toISOString(), "2026-03-29T01:00:00.000Z");
  const fold = e.resolveWall(wall("2026-10-25T02:30:00"), "Europe/Paris");
  assert.equal(fold.fold, true);
  assert.equal(
    new Date(fold.instant).toISOString(),
    "2026-10-25T00:30:00.000Z",
  );
});
test("edits preserve the recorded name and original quantity in audit", () => {
  const { s, t, at } = record();
  const changed = applyTotakeAction(
    s,
    {
      action: "save_treatment",
      draft: {
        ...s.treatments![0],
        name: "Renamed fictional medicine",
        groupIntervals: {},
        groupEdits: {},
      },
    },
    randomUUID(),
    at + 1000,
  );
  assert.equal(changed.audit[0].itemName, t.name);
  assert.match(changed.audit[0].dose!, /^1 tablet/);
});

test("count ledger retains all 12 decimal places at large balances and Undo restores exactly", () => {
  const { s, t } = fixture();
  const draft = {
    ...t,
    inventory: { ...t.inventory, current: "999999999.999999999999" },
    slots: t.slots.map((slot) => ({ ...slot, quantity: "0.000000000001" })),
  };
  const next = applyTotakeAction(
    s,
    { action: "save_treatment", draft },
    randomUUID(),
    now,
  );
  const g = next.groups[0];
  const taken = applyTotakeAction(
    next,
    {
      action: "record",
      groupId: g.id,
      itemIds: [g.items[0].id],
      outcome: "taken",
    },
    randomUUID(),
    g.items[0].alertInstant!,
  );
  assert.equal(
    taken.treatments![0].inventory.current,
    "999999999.999999999998",
  );
  const r = taken.groups.find((x) => x.id === g.id)!.records[0];
  const undone = applyTotakeAction(
    taken,
    { action: "undo", groupId: g.id, recordId: r.id },
    randomUUID(),
    g.items[0].alertInstant! + 1000,
  );
  assert.equal(
    undone.treatments![0].inventory.current,
    "999999999.999999999999",
  );
});

test("daily, weekdays, day intervals and accepted cycles generate their selected calendar days", () => {
  const base = emptyTotake(now),
    today = Math.floor(base.now / 1440);
  for (const schedule of ["weekdays", "interval", "cycle"] as const) {
    const t = e.newTreatment("medication", "custom", today + 1);
    t.name = "Synthetic schedule matrix";
    t.schedule = schedule;
    t.intervalEvery = 3;
    t.intervalUnit = "days";
    t.weekdays = [1, 3];
    t.onDays = 2;
    t.offDays = 2;
    t.proposalAccepted = true;
    const s = applyTotakeAction(
      base,
      { action: "save_treatment", draft: t },
      randomUUID(),
      now,
    );
    const dates = s.groups
      .filter((g) => g.items.length)
      .map((g) => Math.floor(g.due / 1440));
    if (schedule === "interval")
      assert.ok(dates.every((d) => (d - t.startDay) % 3 === 0));
    if (schedule === "cycle")
      assert.ok(dates.every((d) => (d - t.startDay) % 4 < 2));
    if (schedule === "weekdays")
      assert.ok(
        dates.every((d) => [1, 3].includes(new Date(d * 86400000).getUTCDay())),
      );
  }
});
test("hourly intervals retain elapsed spacing through both clock changes and distinct repeated labels", () => {
  for (const start of ["2026-03-28T20:00:00Z", "2026-10-24T20:00:00Z"]) {
    const instant = Date.parse(start),
      base = emptyTotake(instant),
      t = e.newTreatment(
        "medication",
        "custom",
        Math.floor(base.now / 1440) + 1,
      );
    t.name = "Synthetic elapsed schedule";
    t.schedule = "interval";
    t.intervalUnit = "hours";
    t.intervalEvery = 1;
    t.slots[0].time = "01:30";
    const s = applyTotakeAction(
      base,
      { action: "save_treatment", draft: t },
      randomUUID(),
      instant,
    );
    const items = s.groups
      .flatMap((g) => g.items)
      .sort((a, b) => a.alertInstant! - b.alertInstant!);
    for (let n = 1; n < 8; n++)
      assert.equal(
        items[n].alertInstant! - items[n - 1].alertInstant!,
        3600000,
      );
    if (start.includes("10-24")) {
      const repeated = s.groups.filter(
        (g) =>
          e.time(g.due) === "02:30" && Math.floor(g.due / 1440) === t.startDay,
      );
      assert.equal(repeated.length, 2);
      assert.notEqual(repeated[0].id, repeated[1].id);
      assert.notEqual(repeated[0].items[0].id, repeated[1].items[0].id);
    }
  }
});
test("sensor recording consumes exactly one and never shifts the weekly anchor", () => {
  const base = emptyTotake(now),
    t = e.newTreatment("equipment", "sensor", Math.floor(base.now / 1440) + 1);
  t.inventory = { enabled: true, current: "4", threshold: "1", unit: "sensor" };
  const s = applyTotakeAction(
      base,
      { action: "save_treatment", draft: t },
      randomUUID(),
      now,
    ),
    g = s.groups[0],
    second = s.groups[1];
  assert.equal(second.due - g.due, 7 * 1440);
  const taken = applyTotakeAction(
    s,
    {
      action: "record",
      groupId: g.id,
      itemIds: [g.items[0].id],
      outcome: "taken",
    },
    randomUUID(),
    g.items[0].alertInstant! + 3600000,
  );
  assert.equal(taken.treatments![0].inventory.current, "3");
  assert.equal(
    taken.groups.find((x) => x.id === second.id)!.items[0].alertInstant,
    second.items[0].alertInstant,
  );
  assert.equal(
    taken.groups.find((x) => x.id === g.id)!.records[0].insertion,
    true,
  );
});
test("a one-only date change keeps later doses fixed; shared future groups retain their saved repeat interval", () => {
  const { s } = fixture(),
    g = s.groups[0],
    second = s.groups[1],
    id = g.items[0].id;
  const moved = applyTotakeAction(
    s,
    {
      action: "move_reminder",
      groupId: g.id,
      itemId: id,
      toDue: g.due + 60,
      scope: "one",
      acceptProposal: false,
    },
    randomUUID(),
    now,
  );
  assert.equal(
    moved.groups.find((x) => x.items.some((i) => i.id === id))!.due,
    g.due + 60,
  );
  assert.equal(moved.groups.find((x) => x.id === second.id)!.due, second.due);
  const settings = applyTotakeAction(
    moved,
    { action: "settings", repeat: 10, timezone: "Europe/Paris" },
    randomUUID(),
    g.items[0].alertInstant! + 7200000,
  );
  assert.equal(
    settings.groups.find((x) => x.items.some((i) => i.id === id))!.interval,
    30,
  );
  assert.equal(settings.groups.find((x) => x.id === second.id)!.interval, 10);
});

test("changing zones never fabricates a sent alert or delays an already-due repeat", () => {
  const { s } = fixture(),
    g = s.groups[0],
    id = g.items[0].id,
    at = g.items[0].alertInstant! + 3600000;
  const changed = applyTotakeAction(
    s,
    { action: "settings", repeat: 30, timezone: "America/New_York" },
    randomUUID(),
    at,
  );
  const active = changed.groups.find((x) => x.items.some((i) => i.id === id))!;
  assert.equal(active.reminders[id].nextInstant, g.reminders[id].nextInstant);
  assert.equal(active.alerts, g.alerts);
  assert.equal(active.items[0].alertInstant, g.items[0].alertInstant);
  assert.ok(
    changed.groups.some((x) =>
      x.items.some(
        (i) => i.id !== id && i.scheduledZone === "America/New_York",
      ),
    ),
  );
});

test("global and per-app pauses remain independent and legacy Todo privacy is preserved", () => {
  assert.deepEqual(notificationDeliveryPolicy(undefined, "todo"), {
    paused: false,
    showContent: true,
  });
  assert.deepEqual(notificationDeliveryPolicy(undefined, "totake"), {
    paused: false,
    showContent: false,
  });
  const p = { paused: false, todo: false, totake: true, showContent: false };
  assert.equal(notificationDeliveryPolicy(p, "todo").paused, false);
  assert.equal(notificationDeliveryPolicy(p, "totake").paused, true);
  for (const app of ["todo", "totake"] as const)
    assert.equal(
      notificationDeliveryPolicy({ ...p, paused: true }, app).paused,
      true,
    );
  assert.equal(
    notificationDeliveryPolicy(
      { ...p, totake: false, showContent: true },
      "totake",
    ).showContent,
    true,
  );
});

test("Snooze cannot bring a future reminder forward before its scheduled instant", () => {
  const { s } = fixture(),
    g = s.groups[0];
  assert.throws(
    () =>
      applyTotakeAction(
        s,
        {
          action: "snooze",
          groupId: g.id,
          itemIds: [g.items[0].id],
          minutes: 15,
        },
        randomUUID(),
        now,
      ),
    /when this reminder is due/,
  );
  assert.equal(
    s.groups[0].reminders[g.items[0].id].nextInstant,
    g.items[0].alertInstant,
  );
});

test("a delayed read cannot undo an acknowledged save or show another account snapshot", () => {
  const current = { userId: "actor", version: 4 };
  assert.equal(
    acceptTotakeRead(current, { userId: "actor", version: 3 }),
    false,
  );
  assert.equal(
    acceptTotakeRead(current, { userId: "other", version: 5 }),
    false,
  );
  assert.equal(
    acceptTotakeRead(current, { userId: "actor", version: 4 }),
    true,
  );
  assert.equal(
    acceptTotakeRead(current, { userId: "actor", version: 5 }),
    true,
  );
});

test("explicit latest-load cannot be canceled by periodic reads; saving invalidates all earlier read tickets", () => {
  const gate = createTotakeReadGate(),
    background = gate.begin()!,
    explicit = gate.begin(true)!;
  assert.equal(gate.current(background), false);
  assert.equal(gate.begin(), null);
  assert.equal(gate.current(explicit), true);
  gate.finish(background);
  assert.equal(gate.begin(), null);
  gate.finish(explicit);
  const next = gate.begin()!;
  assert.equal(gate.current(next), true);
  gate.invalidate();
  assert.equal(gate.current(next), false);
  assert.notEqual(gate.begin(), null);
});
