import type { Item, Occurrence, State } from "./model";
import { type Treatment, type TimeMove } from "./treatments";
import { resolveWall, wallAt, type Clock } from "./timeZone";
const isHourly = (t: Treatment) =>
  t.schedule === "interval" && t.intervalUnit === "hours";
export function projectGroups(
  groups: Occurrence[],
  clock: Clock,
  treatments: Treatment[],
  moves: TimeMove[],
  prefs: Record<number, number>,
): Occurrence[] {
  const buckets = new Map<string, Occurrence>(),
    usedIds = new Set<string>();
  for (const g of groups)
    if (!g.items.length) {
      buckets.set(`${g.due}|empty|${g.id}`, {
        ...g,
        items: [],
        records: [],
        reminders: {},
      });
      usedIds.add(g.id);
    }
  for (const g of groups)
    for (const original of g.items) {
      const record = g.records.find((r) => r.itemId === original.id),
        t = treatments.find((t) => t.id === original.treatmentId);
      const active =
        !!record ||
        (g.reminders[original.id]?.started ?? g.alerts > 0) ||
        g.reminders[original.id]?.snoozedInstant != null ||
        (original.alertInstant !== undefined &&
          original.alertInstant <= clock.instant);
      let item = { ...original },
        due = g.due,
        instant = original.alertInstant;
      if (!active || instant === undefined) {
        if (t && isHourly(t) && item.seriesIndex !== undefined) {
          const start =
            t.startDay * 1440 +
            Number(t.slots[0].time.slice(0, 2)) * 60 +
            Number(t.slots[0].time.slice(3));
          const anchor =
              clock.anchors[t.id] ?? resolveWall(start, clock.zone).instant,
            base = anchor + item.seriesIndex * t.intervalEvery * 3600000;
          const rules = moves.filter(
            (m) => m.treatmentId === t.id && m.slotId === item.slotId,
          );
          const fromIndex = (m: TimeMove) =>
            m.fromIndex ??
            Math.round((m.fromDue - start) / (t.intervalEvery * 60));
          const future = rules
            .filter(
              (m) => m.scope === "future" && item.seriesIndex! >= fromIndex(m),
            )
            .at(-1);
          const single = rules.find(
            (m) => m.scope === "one" && m.key === item.scheduledKey,
          );
          instant =
            base +
            (future
              ? (future.elapsedShift ??
                resolveWall(future.toDue, clock.zone).instant -
                  (anchor + fromIndex(future) * t.intervalEvery * 3600000))
              : 0);
          if (single)
            instant =
              single.instant ?? resolveWall(single.toDue, clock.zone).instant;
          due = wallAt(instant, clock.zone);
        } else instant = resolveWall(due, clock.zone).instant;
      }
      item.alertInstant = instant;
      item.scheduledZone = active
        ? (original.scheduledZone ?? clock.zone)
        : clock.zone;
      if (t?.kind === "equipment" && t.equipmentType === "sensor" && !record)
        item = {
          ...item,
          dose: "Insert new sensor",
          quantity: "1",
          unit: t.unit,
          sensorInsertion: true,
        };
      const key = `${due}|${instant}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        let id = record
          ? g.id
          : `${Math.floor(due / 1440)}-${((due % 1440) + 1440) % 1440}`;
        if (usedIds.has(id)) id += `@${instant}`;
        usedIds.add(id);
        bucket = {
          ...g,
          id,
          due,
          items: [],
          records: [],
          reminders: {},
          interval: active
            ? g.interval
            : (prefs[((due % 1440) + 1440) % 1440] ?? g.interval),
        };
        buckets.set(key, bucket);
      }
      if (!record && (g.reminders[original.id]?.started ?? g.alerts > 0)) {
        bucket.interval = g.interval;
        bucket.alerts = Math.max(bucket.alerts, g.alerts);
        if (
          (g.lastAlertInstant ?? -Infinity) >
          (bucket.lastAlertInstant ?? -Infinity)
        ) {
          bucket.lastAlertInstant = g.lastAlertInstant;
          bucket.lastAlert = g.lastAlert;
        }
      }
      if (bucket.items.some((i) => i.id === item.id)) continue;
      const old = g.reminders[original.id],
        nextInstant = active
          ? (old.nextInstant ?? resolveWall(old.next, clock.zone).instant)
          : instant!;
      bucket.items.push(item);
      if (record) bucket.records.push(record);
      bucket.reminders[item.id] = {
        ...old,
        started: old.started ?? g.alerts > 0,
        nextInstant,
        next: wallAt(nextInstant, clock.zone),
        snoozedInstant:
          old.snoozedInstant ??
          (old.snoozedUntil === null
            ? null
            : resolveWall(old.snoozedUntil, clock.zone).instant),
        snoozedUntil: old.snoozedInstant
          ? wallAt(old.snoozedInstant, clock.zone)
          : old.snoozedUntil,
      };
    }
  return [...buckets.values()].sort((a, b) => a.due - b.due);
}
export function reconcileClock(s: State): State {
  if (!s.clock) return s;
  const anchors = { ...s.clock.anchors };
  for (const t of s.treatments ?? [])
    if (isHourly(t) && anchors[t.id] === undefined)
      anchors[t.id] = resolveWall(
        t.startDay * 1440 +
          Number(t.slots[0].time.slice(0, 2)) * 60 +
          Number(t.slots[0].time.slice(3)),
        s.clock.zone,
      ).instant;
  const clock = { ...s.clock, anchors },
    groups = projectGroups(
      s.groups,
      clock,
      s.treatments ?? [],
      s.timeMoves ?? [],
      s.repeatPreferences,
    ),
    present = new Set(groups.map((g) => g.id));
  for (const old of s.groups)
    if (!present.has(old.id) && s.audit.some((a) => a.groupId === old.id)) {
      groups.push({ ...old, items: [], records: [], reminders: {} });
      present.add(old.id);
    }
  return {
    ...s,
    clock,
    now: wallAt(clock.instant, clock.zone),
    groups: groups.sort((a, b) => a.due - b.due),
  };
}
export function initializeClock(s: State, zone = "Europe/Paris"): State {
  return s.clock
    ? reconcileClock(s)
    : reconcileClock({
        ...s,
        clock: { zone, instant: resolveWall(s.now, zone).instant, anchors: {} },
      });
}
export function changeZone(s: State, zone: string): State {
  const current = initializeClock(s);
  wallAt(current.clock!.instant, zone);
  const started = new Set(
    current.groups.flatMap((g) =>
      g.items
        .filter(
          (i) =>
            g.records.some((r) => r.itemId === i.id) ||
            (g.reminders[i.id]?.started ?? g.alerts > 0) ||
            i.alertInstant! <= current.clock!.instant,
        )
        .map((i) => i.id),
    ),
  );
  const projected = reconcileClock({
    ...current,
    clock: { ...current.clock!, zone },
  });
  const next = {
    ...projected,
    groups: projected.groups.map((g) => ({
      ...g,
      reminders: Object.fromEntries(
        Object.entries(g.reminders).map(([id, r]) => [
          id,
          !started.has(id) && r.nextInstant! < current.clock!.instant
            ? { ...r, nextInstant: current.clock!.instant, next: projected.now }
            : r,
        ]),
      ),
    })),
  };
  // Zone edits reconcile schedules; only the delivery callback advances sends.
  return next;
}
export function snoozeClock(
  s: State,
  groupId: string,
  ids: string[],
  minutes: number,
): State {
  const at = s.clock!.instant + minutes * 60000;
  return {
    ...s,
    groups: s.groups.map((g) =>
      g.id !== groupId
        ? g
        : {
            ...g,
            reminders: Object.fromEntries(
              Object.entries(g.reminders).map(([id, r]) => [
                id,
                ids.includes(id) && !g.records.some((x) => x.itemId === id)
                  ? {
                      ...r,
                      nextInstant: at,
                      next: wallAt(at, s.clock!.zone),
                      snoozedInstant: at,
                      snoozedUntil: wallAt(at, s.clock!.zone),
                    }
                  : r,
              ]),
            ),
          },
    ),
  };
}
export function undoClock(s: State, groupId: string, itemId: string): State {
  const g = s.groups.find((g) => g.id === groupId),
    i = g?.items.find((i) => i.id === itemId);
  if (!g || !i) return s;
  const at = Math.max(
    s.clock!.instant,
    i.alertInstant ?? resolveWall(g.due, s.clock!.zone).instant,
  );
  return {
    ...s,
    groups: s.groups.map((x) =>
      x.id !== groupId
        ? x
        : {
            ...x,
            reminders: {
              ...x.reminders,
              [itemId]: {
                nextInstant: at,
                next: wallAt(at, s.clock!.zone),
                visible: at <= s.clock!.instant,
                started: at <= s.clock!.instant,
                snoozedInstant: null,
                snoozedUntil: null,
              },
            },
          },
    ),
  };
}
export function moveZonedHourly(
  s: State,
  groupId: string,
  itemId: string,
  toDue: number,
  scope: "one" | "future",
): State {
  const source = s.groups.find((g) => g.id === groupId),
    item = source?.items.find((i) => i.id === itemId),
    t = s.treatments?.find((t) => t.id === item?.treatmentId);
  if (!source || !item || !t || source.records.some((r) => r.itemId === itemId))
    throw Error("Reopen an unrecorded hourly reminder.");
  if (scope !== "one" && scope !== "future")
    throw Error("Choose This reminder only or This and all future reminders.");
  const target = resolveWall(toDue, s.clock!.zone).instant;
  if (target < s.clock!.instant)
    throw Error("Choose a reference time at or after the current time.");
  const index = item.seriesIndex!,
    base = s.clock!.anchors[t.id] + index * t.intervalEvery * 3600000;
  const rule: TimeMove = {
    key: item.scheduledKey!,
    treatmentId: t.id,
    slotId: item.slotId!,
    fromDue: Number(item.scheduledKey!.split("|").at(-1)),
    toDue,
    scope,
    fromIndex: index,
    instant: target,
    elapsedShift: target - base,
  };
  const moves = [
    ...(s.timeMoves ?? []).filter(
      (m) => !(m.scope === "one" && m.key === rule.key),
    ),
    rule,
  ];
  const changed = s.groups.map((g) => {
    const moving = g.items.filter(
      (i) =>
        !g.records.some((r) => r.itemId === i.id) &&
        i.treatmentId === t.id &&
        (scope === "one" ? i.id === item.id : i.seriesIndex! >= index),
    );
    return {
      ...g,
      items: g.items.map((i) =>
        moving.includes(i) ? { ...i, alertInstant: undefined } : i,
      ),
      alerts: moving.length === g.items.length ? 0 : g.alerts,
      reminders: { ...g.reminders },
    };
  });
  // Isolate moved items so an unresolved mixed group cannot freeze their old timers.
  const isolated: Occurrence[] = [];
  for (const g of changed) {
    const moved = g.items.filter(
      (i) => i.alertInstant === undefined && i.treatmentId === t.id,
    );
    isolated.push({
      ...g,
      items: g.items.filter((i) => !moved.includes(i)),
      records: g.records,
    });
    for (const i of moved)
      isolated.push({
        ...g,
        items: [i],
        records: [],
        alerts: 0,
        lastAlert: null,
        reminders: {
          [i.id]: { next: toDue, snoozedUntil: null, visible: false },
        },
      });
  }
  return reconcileClock({
    ...s,
    timeMoves: moves,
    groups: isolated,
    events: [
      ...s.events,
      {
        at: s.now,
        groupId: source.id,
        text: `Explicit hourly adjustment · ${scope === "one" ? "next reminder only; interval anchor unchanged" : "new elapsed-time anchor for this and later reminders"}`,
      },
    ],
  });
}
