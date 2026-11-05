import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  totakeEngine as e,
  totakeMutationSchema,
  type TotakeState,
  type TotakeAction,
} from "@wuff/contracts";
import {
  emptyTotake,
  applyTotakeAction,
  refreshTotake,
  totakeNeedsScheduler,
} from "../packages/domain/src/modules/totake/state";
import {
  validateNotificationAction,
  notificationItemIdentity,
} from "../packages/contracts/src/modules/totake/notification";

const now = Date.parse("2026-10-24T06:00:00Z");
const change = (s: TotakeState, action: TotakeAction, at = s.clock!.instant) =>
  applyTotakeAction(s, action, randomUUID(), at);
function fixture(kind: "medication" | "equipment" = "medication") {
  let s = emptyTotake(now);
  const t = e.newTreatment(kind, "custom", Math.floor(s.now / 1440));
  t.name = "Fictional lifecycle item";
  t.slots[0].time = "08:00";
  t.inventory = { enabled: true, current: "10", threshold: "20", unit: t.unit };
  s = change(s, { action: "save_treatment", draft: t });
  return { s, t };
}
const status = (
  s: TotakeState,
  id: string,
  value: "active" | "paused" | "archived",
  at?: number,
) =>
  change(
    s,
    { action: "set_treatment_status", treatmentId: id, status: value },
    at,
  );

test("lifecycle actions validate IDs and transitions; setup cannot forge server-owned status", () => {
  const { t } = fixture();
  const input = {
    operationId: randomUUID(),
    version: 0,
    change: {
      action: "set_treatment_status",
      treatmentId: t.id,
      status: "paused",
    },
  };
  assert(totakeMutationSchema.safeParse(input).success);
  assert(
    !totakeMutationSchema.safeParse({
      ...input,
      change: { ...input.change, status: "deleted" },
    }).success,
  );
  assert(
    !totakeMutationSchema.safeParse({
      ...input,
      change: { ...input.change, treatmentId: "unknown" },
    }).success,
  );
  assert(
    !totakeMutationSchema.safeParse({
      ...input,
      change: { action: "save_treatment", draft: { ...t, status: "active" } },
    }).success,
  );
});

for (const value of ["paused", "archived", "deleted"] as const) {
  test(`${value} stops due, snoozed and future reminders without recording or changing stock`, () => {
    const { s: initial, t } = fixture();
    const g = initial.groups[0],
      id = g.items[0].id;
    const s = change(initial, {
      action: "snooze",
      groupId: g.id,
      itemIds: [id],
      minutes: 30,
    });
    const next =
      value === "deleted"
        ? change(s, { action: "delete_treatment", treatmentId: t.id })
        : status(s, t.id, value);
    assert.equal(next.treatments![0].status, value);
    assert.equal(next.groups.flatMap(e.pending).length, 0);
    assert.equal(totakeNeedsScheduler(next), false);
    assert.deepEqual(next.audit, s.audit);
    assert.deepEqual(next.stock!.movements, s.stock!.movements);
    assert.equal(next.treatments![0].inventory.current, "10");
    assert.deepEqual(e.lowStockWarnings(next), []);
    assert.equal(
      refreshTotake(next, now + 40 * 86400000).groups.flatMap(e.pending).length,
      0,
    );
    assert.throws(() =>
      change(next, {
        action: "record",
        groupId: g.id,
        itemIds: [id],
        outcome: "taken",
      }),
    );
  });
}

test("pausing one grouped item retains another item's exact snooze/repeat state", () => {
  const { s: first, t } = fixture();
  const other = {
    ...e.newTreatment("medication", "custom", t.startDay),
    name: "Other fictional item",
  };
  let s = change(first, { action: "save_treatment", draft: other });
  const group = s.groups[0];
  const secondId = group.items.find((i) => i.treatmentId === other.id)!.id;
  s = change(s, {
    action: "snooze",
    groupId: group.id,
    itemIds: [secondId],
    minutes: 45,
  });
  const before = refreshTotake(s, now).groups.find((g) => g.id === group.id)!;
  assert.equal(before.reminders[secondId].visible, false);
  const next = status(s, t.id, "paused");
  const remaining = next.groups.find((g) => g.id === group.id)!;
  assert.deepEqual(
    remaining.items,
    before.items.filter((i) => i.treatmentId !== t.id),
  );
  assert.deepEqual(remaining.reminders[secondId], before.reminders[secondId]);
  assert.equal(remaining.interval, before.interval);
  assert.equal(totakeNeedsScheduler(next), true);
});

for (const value of ["paused", "archived", "deleted"] as const) {
  test(`${value} preserves taken/skipped snapshots and exact stock Undo without reviving alerts`, () => {
    let { s, t } = fixture();
    const g = s.groups[0];
    s = change(s, {
      action: "record",
      groupId: g.id,
      itemIds: [g.items[0].id],
      outcome: "taken",
    });
    const second = s.groups[1];
    s = change(s, {
      action: "record",
      groupId: second.id,
      itemIds: [second.items[0].id],
      outcome: "skipped",
    });
    const before = structuredClone(s);
    s =
      value === "deleted"
        ? change(s, { action: "delete_treatment", treatmentId: t.id })
        : status(s, t.id, value);
    assert.deepEqual(s.audit, before.audit);
    assert.deepEqual(s.stock!.movements, before.stock!.movements);
    for (const group of before.groups.filter((g) => g.records.length)) {
      const saved = s.groups.find((g) => g.id === group.id)!;
      assert.deepEqual(saved.items, group.items);
      assert.deepEqual(saved.records, group.records);
    }
    const recordId = s.groups.find((x) => x.id === g.id)!.records[0].id;
    s = change(s, { action: "undo", groupId: g.id, recordId });
    assert.equal(s.treatments![0].inventory.current, "10");
    assert.equal(
      s.stock!.movements.filter((m) => m.reverses === `stock-${recordId}`)
        .length,
      1,
    );
    assert.equal(s.groups.flatMap(e.pending).length, 0);
    assert.equal(s.audit.at(-1)!.action, "undo");
  });
}

test("resume and restore cross DST without backfill, changing the anchor or duplicating occurrences", () => {
  for (const value of ["paused", "archived"] as const) {
    let { s, t } = fixture();
    const hourly = {
      ...t,
      schedule: "interval" as const,
      intervalUnit: "hours" as const,
      intervalEvery: 6,
    };
    s = change(s, { action: "save_treatment", draft: hourly });
    const anchor = s.clock!.anchors[t.id];
    s = status(s, t.id, value);
    const at = Date.parse("2026-10-26T12:00:00Z");
    s = status(s, t.id, "active", at);
    assert.equal(s.clock!.anchors[t.id], anchor);
    assert.equal(s.treatments![0].status, "active");
    assert(s.groups.flatMap(e.pending).length > 0);
    assert(s.groups.flatMap(e.pending).every((i) => i.alertInstant! >= at));
    assert(
      s.groups
        .flatMap(e.pending)
        .every((i) => (i.alertInstant! - anchor) % (6 * 3600000) === 0),
    );
    const ids = s.groups.flatMap((g) => g.items.map((i) => i.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(s.audit, []);
    assert.equal(s.treatments![0].inventory.current, "10");
  }
});

test("editing a paused definition keeps it paused; deleted IDs cannot be edited or restored", () => {
  const { s: initial, t } = fixture();
  let s = status(initial, t.id, "paused");
  s = change(s, {
    action: "save_treatment",
    draft: { ...t, name: "Edited while paused" },
  });
  assert.equal(s.treatments![0].status, "paused");
  assert.equal(s.groups.flatMap(e.pending).length, 0);
  s = change(s, { action: "delete_treatment", treatmentId: t.id });
  assert.throws(
    () => change(s, { action: "save_treatment", draft: t }),
    /deleted/,
  );
  assert.throws(() => status(s, t.id, "active"), /no longer available/);
  assert.throws(() => status(s, randomUUID(), "paused"), /no longer available/);
});

test("paused, archived and deleted as-needed entries cannot be used by stale intake forms", () => {
  for (const value of ["paused", "archived", "deleted"] as const) {
    let { s, t } = fixture();
    const prn = { ...t, schedule: "prn" as const };
    s = change(s, { action: "save_treatment", draft: prn });
    const draft = { ...e.newIntake(s), medicationId: t.id };
    s =
      value === "deleted"
        ? change(s, { action: "delete_treatment", treatmentId: t.id })
        : status(s, t.id, value);
    assert.throws(
      () => change(s, { action: "record_intake", draft }),
      /active as-needed/,
    );
    assert.equal(s.intakes!.length, 0);
  }
});

test("old notification selections are rejected after lifecycle cancellation", () => {
  const { s, t } = fixture();
  const g = s.groups[0],
    item = g.items[0];
  const context = {
    userId: randomUUID(),
    deviceId: randomUUID(),
    groupId: g.id,
    itemId: item.id,
    identity: notificationItemIdentity(g, item),
    lastAuditId: null,
    issuedAt: now,
    expiresAt: now + 3600000,
  };
  const action = {
    action: "record" as const,
    groupId: g.id,
    itemIds: [item.id],
    outcome: "taken" as const,
  };
  assert.doesNotThrow(() =>
    validateNotificationAction(s, action, context, context.userId, now),
  );
  const next = status(s, t.id, "paused");
  assert.throws(() =>
    validateNotificationAction(next, action, context, context.userId, now),
  );
});
