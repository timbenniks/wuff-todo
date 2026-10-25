
import { stockEligible } from "./inventory";
import { projectGroups, reconcileClock, moveZonedHourly } from "./zonedScheduler";
import { resolveWall, type Clock } from "./timeZone";
import { stockSetup } from "./stock";
import type { Item, Occurrence, State } from "./model";
import { dayDate, isoDay } from "./calendar";
export type ScheduleKind =
  "daily" | "twice" | "prn" | "interval" | "multiple" | "weekdays" | "cycle";
export type Slot = { id: string; time: string; quantity: string };
export type Treatment = {
  id: string;
  name: string;
  kind: "medication" | "equipment";
  equipmentType: "sensor" | "catheter" | "custom";
  form: string;
  unit: string;
  detail: string;
  schedule: ScheduleKind;
  intervalEvery: number;
  intervalUnit: "hours" | "days";
  weekdays: number[];
  onDays: number;
  offDays: number;
  proposalAccepted: boolean;
  startDay: number;
  slots: Slot[];
  repeat: number;
  inventory: {
    enabled: boolean;
    current: string;
    threshold: string;
    unit: string;
  };
  revision: number;
};
export type SetupDraft = Treatment & {
  startDateText?: string;
  groupIntervals: Record<number, number>;
  groupEdits: Record<number, boolean>;
};
export type TimeMove = {
  key: string;
  treatmentId: string;
  slotId: string;
  fromDue: number;
  toDue: number;
  scope: "one" | "future";
  instant?: number;
  fromIndex?: number;
  elapsedShift?: number;
};
export const minute = (clock: string) =>
  Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
export const clock = (n: number) =>
  `${String(Math.floor((((n % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((n % 60) + 60) % 60).padStart(2, "0")}`;
export const fromISO = (v: string) =>
  Math.round((Date.parse(v + "T00:00:00Z") - Date.UTC(1970, 0, 1)) / 86400000);
function futureItem(s: State, g: Occurrence, i: Item) {
  return s.clock
    ? (i.alertInstant ?? resolveWall(g.due, s.clock.zone).instant) >
        s.clock.instant
    : g.due > s.now;
}
function futureGroup(s: State, g: Occurrence) {
  return g.items.every((i) => futureItem(s, g, i));
}
export function newTreatment(
  kind: Treatment["kind"],
  equipmentType: Treatment["equipmentType"] = "custom",
  day = 0,
  repeat = 30,
): SetupDraft {
  return {
    id: crypto.randomUUID(),
    name:
      kind === "equipment"
        ? equipmentType === "sensor"
          ? "Sensor"
          : equipmentType === "catheter"
            ? "Catheter"
            : "Custom equipment"
        : "",
    kind,
    equipmentType,
    form: kind === "medication" ? "Tablet" : equipmentType,
    unit:
      kind === "medication"
        ? "tablet"
        : equipmentType === "custom"
          ? "item"
          : equipmentType,
    detail: "",
    schedule:
      kind === "equipment" && equipmentType === "sensor" ? "interval" : "daily",
    intervalEvery: kind === "equipment" && equipmentType === "sensor" ? 7 : 1,
    intervalUnit: "days",
    weekdays: [1, 2, 3, 4, 5],
    onDays: 5,
    offDays: 2,
    proposalAccepted: false,
    startDay: day,
    slots: [{ id: crypto.randomUUID(), time: "08:00", quantity: "1" }],
    repeat,
    inventory: {
      enabled: false,
      current: "0",
      threshold: "0",
      unit:
        kind === "medication"
          ? "tablet"
          : equipmentType === "custom"
            ? "item"
            : equipmentType,
    },
    revision: 1,
    groupIntervals: {},
    groupEdits: {},
  };
}
export const dose = (t: Treatment, slot: Slot) =>
  t.kind === "equipment" && t.equipmentType === "sensor"
    ? "Insert new sensor"
    : `${slot.quantity} ${t.unit}${t.detail ? " · " + t.detail : ""}`;
export function scheduleLabel(t: Treatment) {
  return {
    daily: "Once daily",
    twice: "Twice daily",
    prn: "As needed",
    multiple: "Multiple times daily",
    weekdays: "Specific weekdays",
    cycle: `${t.onDays} days on / ${t.offDays} days off`,
    interval: `Every ${t.intervalEvery} ${t.intervalUnit === "hours" ? "hours (elapsed)" : "days (local time)"}`,
  }[t.schedule];
}
export function treatmentTimes(t: Treatment): number[] {
  if (t.schedule === "prn") return [];
  if (t.schedule === "interval" && t.intervalUnit === "hours") {
    const times = new Set<number>();
    for (let k = 0; k < 24; k++)
      times.add((minute(t.slots[0].time) + k * t.intervalEvery * 60) % 1440);
    return [...times].sort((a, b) => a - b);
  }
  return t.slots.map((slot) => minute(slot.time));
}
export const sameSchedule = (a: Treatment, b: Treatment) =>
  JSON.stringify([
    a.schedule,
    a.startDay,
    a.slots.map((s) => [s.id, s.time]),
    a.intervalEvery,
    a.intervalUnit,
    [...a.weekdays].sort((x, y) => x - y),
    a.onDays,
    a.offDays,
  ]) ===
  JSON.stringify([
    b.schedule,
    b.startDay,
    b.slots.map((s) => [s.id, s.time]),
    b.intervalEvery,
    b.intervalUnit,
    [...b.weekdays].sort((x, y) => x - y),
    b.onDays,
    b.offDays,
  ]);
export function actualGroupTimes(s: State, id: string): number[] {
  return [
    ...new Set(
      s.groups
        .filter((g) =>
          g.items.some(
            (i) =>
              i.treatmentId === id && !g.records.some((r) => r.itemId === i.id),
          ),
        )
        .map((g) => ((g.due % 1440) + 1440) % 1440),
    ),
  ];
}
export function setupGroupTimes(
  t: Treatment,
  s: State,
  original?: Treatment,
): number[] {
  return [
    ...new Set([
      ...treatmentTimes(t),
      ...(original && sameSchedule(t, original)
        ? actualGroupTimes(s, t.id)
        : []),
      ...(s.timeMoves ?? [])
        .filter((m) => m.treatmentId === t.id && m.scope === "one")
        .map((m) => ((m.toDue % 1440) + 1440) % 1440),
    ]),
  ].sort((a, b) => a - b);
}
function administrations(
  t: Treatment,
  day: number,
): { slot: Slot; due: number; index: number }[] {
  if (day < t.startDay || t.schedule === "prn") return [];
  const delta = day - t.startDay;
  if (
    t.schedule === "weekdays" &&
    !t.weekdays.includes(dayDate(day).getUTCDay())
  )
    return [];
  if (t.schedule === "cycle" && delta % (t.onDays + t.offDays) >= t.onDays)
    return [];
  if (
    t.schedule === "interval" &&
    t.intervalUnit === "days" &&
    delta % t.intervalEvery
  )
    return [];
  if (t.schedule === "interval" && t.intervalUnit === "hours") {
    const anchor = t.startDay * 1440 + minute(t.slots[0].time),
      stride = t.intervalEvery * 60;
    const out: { slot: Slot; due: number; index: number }[] = [];
    for (
      let k = Math.max(0, Math.ceil((day * 1440 - anchor) / stride));
      anchor + k * stride < (day + 1) * 1440;
      k++
    )
      out.push({ slot: t.slots[0], due: anchor + k * stride, index: k });
    return out;
  }
  return t.slots.map((slot) => ({
    slot,
    due: day * 1440 + minute(slot.time),
    index: delta,
  }));
}
export function planDay(
  treatments: Treatment[],
  day: number,
  prefs: Record<number, number>,
  moves: TimeMove[] = [],
  clockContext?: Clock,
): Occurrence[] {
  const map = new Map<number, Occurrence>();
  for (const t of treatments)
    for (const a of administrations(t, day)) {
      const key = `${t.id}|${a.slot.id}|${a.due}`;
      let due = a.due;
      const single = moves.find((m) => m.scope === "one" && m.key === key);
      const recurring = moves
        .filter(
          (m) =>
            m.scope === "future" &&
            m.treatmentId === t.id &&
            m.slotId === a.slot.id &&
            a.due >= m.fromDue,
        )
        .at(-1);
      if (recurring)
        due =
          t.schedule === "interval" && t.intervalUnit === "hours"
            ? due + (recurring.toDue - recurring.fromDue)
            : Math.floor(due / 1440) * 1440 +
              (((recurring.toDue % 1440) + 1440) % 1440) +
              (Math.floor(recurring.toDue / 1440) -
                Math.floor(recurring.fromDue / 1440)) *
                1440;
      if (single) due = single.toDue;
      const item: Item = {
        id: key,
        treatmentId: t.id,
        slotId: a.slot.id,
        scheduledKey: key,
        originDay: day,
        seriesIndex: a.index,
        movedFrom: due !== a.due ? a.due : undefined,
        hourly: t.schedule === "interval" && t.intervalUnit === "hours",
        name: t.name,
        dose: dose(t, a.slot),
        quantity: a.slot.quantity,
        unit: t.unit,
        kind: t.kind,
      };
      let g = map.get(due);
      if (!g) {
        g = {
          id: `${Math.floor(due / 1440)}-${((due % 1440) + 1440) % 1440}`,
          due,
          title:
            clock(a.due) === "08:00"
              ? "Morning"
              : clock(a.due) === "18:00"
                ? "Evening"
                : clock(a.due) === "12:00"
                  ? "Midday"
                  : "Scheduled reminders",
          items: [],
          records: [],
          interval: prefs[((due % 1440) + 1440) % 1440] ?? t.repeat,
          reminders: {},
          alerts: 0,
          lastAlert: null,
        };
        map.set(due, g);
      }
      g.items.push(item);
      g.reminders[item.id] = { next: due, snoozedUntil: null, visible: false };
    }
  const result = [...map.values()];
  return clockContext
    ? projectGroups(result, clockContext, treatments, moves, prefs)
    : result;
}
function mergeGroups(
  existing: Occurrence[],
  extra: Occurrence[],
  now: number,
  protectedItems: Item[] = [],
  clockContext?: Clock,
): Occurrence[] {
  const groupKey = (g: Occurrence): string | number =>
    clockContext
      ? `${g.due}|${g.items[0]?.alertInstant ?? resolveWall(g.due, clockContext.zone).instant}`
      : g.due;
  const map = new Map(
    existing.map((g) => [
      groupKey(g),
      { ...g, items: [...g.items], reminders: { ...g.reminders } },
    ]),
  );
  for (const added of extra) {
    let g = map.get(groupKey(added));
    for (const item of added.items) {
      if (
        protectedItems.some(
          (p) =>
            p.treatmentId === item.treatmentId &&
            p.slotId === item.slotId &&
            (p.hourly || item.hourly
              ? p.seriesIndex === item.seriesIndex
              : p.originDay === item.originDay),
        )
      )
        continue;
      if (g?.items.some((i) => i.id === item.id)) continue;
      if (!g) {
        g = { ...added, items: [], reminders: {} };
        map.set(groupKey(added), g);
      }
      g.items.push(item);
      g.reminders[item.id] = {
        ...added.reminders[item.id],
        next:
          g.lastAlert !== null && g.lastAlert + g.interval > now
            ? g.lastAlert + g.interval
            : Math.max(now, g.due),
        snoozedUntil: null,
        visible: g.due <= now,
        ...(clockContext
          ? {
              nextInstant:
                g.lastAlertInstant !== undefined &&
                g.lastAlertInstant + g.interval * 60000 > clockContext.instant
                  ? g.lastAlertInstant + g.interval * 60000
                  : Math.max(
                      clockContext.instant,
                      item.alertInstant ??
                        resolveWall(g.due, clockContext.zone).instant,
                    ),
            }
          : {}),
      };
    }
  }
  return [...map.values()].sort((a, b) => a.due - b.due);
}
export function extendSchedule(s: State, endDay: number): State {
  const lookahead = Math.max(
    0,
    ...(s.timeMoves ?? [])
      .filter((m) => m.scope === "future")
      .map((m) => Math.ceil((m.fromDue - m.toDue) / 1440)),
  );
  endDay += lookahead;
  const last =
    s.planHorizon ??
    Math.max(0, ...s.groups.map((g) => Math.floor(g.due / 1440)));
  if (endDay <= last) return s;
  const extra: Occurrence[] = [];
  for (let d = last + 1; d <= endDay; d++)
    extra.push(
      ...planDay(s.treatments!, d, s.repeatPreferences, s.timeMoves, s.clock),
    );
  return {
    ...s,
    groups: mergeGroups(s.groups, extra, s.now, [], s.clock),
    planHorizon: endDay,
  };
}
export function validateTreatment(
  t: SetupDraft,
  now: number,
  editing: boolean,
): string[] {
  const errors: string[] = [];
  if (t.inventory.enabled && !stockEligible(t))
    errors.push(
      "Stock tracking supports counted units only; liquids and drops are not tracked.",
    );
  if (t.inventory.enabled && t.inventory.unit !== t.unit)
    errors.push("Stock uses the dose count unit.");
  if (
    t.kind === "equipment" &&
    t.equipmentType === "sensor" &&
    t.slots.some((slot) => Number(slot.quantity) !== 1)
  )
    errors.push(
      "Enter a time and positive quantity of exactly 1 sensor per insertion.",
    );
  if (
    ![5, 10, 15, 20, 30].includes(t.repeat) ||
    Object.values(t.groupIntervals).some(
      (n) => ![5, 10, 15, 20, 30].includes(n),
    )
  )
    errors.push("Choose a supported repeat interval.");
  if (!t.name.trim()) errors.push("Enter a name.");
  if (t.name.trim().length > 180)
    errors.push("Keep the name within 180 characters.");
  if (!t.unit.trim() || !t.form.trim())
    errors.push("Choose a form/type and unit, or enter your own.");
  if (!Number.isInteger(t.startDay))
    errors.push("Enter a valid start date in DD-MM-YYYY.");
  else if (!editing && t.startDay < Math.floor(now / 1440))
    errors.push(
      "Choose today or a future start date; historical doses are not backfilled.",
    );
  if (
    t.schedule === "prn" &&
    (!Number.isFinite(Number(t.slots[0]?.quantity)) ||
      Number(t.slots[0]?.quantity) <= 0)
  )
    errors.push("Enter a positive reference quantity.");
  if (t.schedule !== "prn") {
    if (
      !t.slots.length ||
      t.slots.some(
        (slot) =>
          !/^\d{2}:\d{2}$/.test(slot.time) ||
          minute(slot.time) > 1439 ||
          Number(slot.time.slice(3)) > 59 ||
          !Number.isFinite(Number(slot.quantity)) ||
          Number(slot.quantity) <= 0,
      )
    )
      errors.push(
        "Enter a valid time and positive quantity for every administration.",
      );
    if (new Set(t.slots.map((slot) => slot.time)).size !== t.slots.length)
      errors.push("Use different times for each administration.");
  }
  if (t.schedule === "twice" && t.slots.length !== 2)
    errors.push("Enter a time and positive quantity for both administrations.");
  if (t.schedule === "multiple" && t.slots.length < 2)
    errors.push(
      "Enter a time and positive quantity for at least two administrations.",
    );
  if (t.schedule === "weekdays" && !t.weekdays.length)
    errors.push("Select at least one weekday.");
  if (
    t.schedule === "interval" &&
    (!Number.isInteger(t.intervalEvery) ||
      t.intervalEvery < 1 ||
      t.intervalEvery > (t.intervalUnit === "hours" ? 168 : 365))
  )
    errors.push("Enter a whole interval from 1 to 168 hours or 1 to 365 days.");
  if (
    t.schedule === "cycle" &&
    (!Number.isInteger(t.onDays) ||
      !Number.isInteger(t.offDays) ||
      t.onDays < 1 ||
      t.offDays < 1 ||
      t.onDays + t.offDays > 366)
  )
    errors.push("Use positive whole on/off days, totalling at most 366.");
  if (t.schedule === "cycle" && !t.proposalAccepted)
    errors.push("Confirm the labelled schedule proposal.");
  if (
    t.inventory.enabled &&
    (!t.inventory.current.trim() ||
      !t.inventory.threshold.trim() ||
      !Number.isFinite(Number(t.inventory.current)) ||
      !Number.isFinite(Number(t.inventory.threshold)) ||
      (!editing && Number(t.inventory.current) < 0) ||
      Number(t.inventory.threshold) < 0 ||
      !t.inventory.unit.trim())
  )
    errors.push(
      "Enter non-negative current stock, low-stock threshold and a stock unit.",
    );
  return errors;
}
export function saveTreatment(s: State, draft: SetupDraft): State {
  const old = s.treatments?.find((t) => t.id === draft.id);
  if (
    s.clock &&
    draft.schedule === "interval" &&
    draft.intervalUnit === "hours" &&
    (!old || !sameSchedule(old, draft))
  )
    s = {
      ...s,
      clock: {
        ...s.clock,
        anchors: {
          ...s.clock.anchors,
          [draft.id]: resolveWall(
            draft.startDay * 1440 + minute(draft.slots[0].time),
            s.clock.zone,
          ).instant,
        },
      },
    };
  const next = saveTreatmentCore(s, draft);
  return reconcileClock(
    stockSetup(
      s,
      next,
      next.treatments!.find((t) => t.id === draft.id)!,
    ),
  );
}
function saveTreatmentCore(s: State, draft: SetupDraft): State {
  const old = s.treatments?.find((t) => t.id === draft.id);
  const errors = validateTreatment(draft, s.now, !!old);
  if (errors.length) throw Error(errors.join(" "));
  s = extendSchedule(
    s,
    Math.max(s.planHorizon ?? 1, Math.floor(s.now / 1440) + 31),
  );
  const {
    groupIntervals,
    groupEdits,
    startDateText: _startDateText,
    ...input
  } = draft;
  const t = {
    ...input,
    weekdays: [...new Set(input.weekdays)].sort((x, y) => x - y),
    slots: input.slots.map((slot) =>
      old &&
      !old.slots.some((s) => s.id === slot.id) &&
      old.slots.some((s) => s.time === slot.time)
        ? { ...slot, id: old.slots.find((s) => s.time === slot.time)!.id }
        : slot,
    ),
    name: input.name.trim(),
    revision: (old?.revision ?? 0) + 1,
  };
  const prefs = { ...s.repeatPreferences },
    overrides = new Set(s.groupOverrides ?? []);
  for (const tm of setupGroupTimes(t, s, old)) {
    if (prefs[tm] === undefined) {
      prefs[tm] = groupIntervals[tm] ?? s.defaultRepeat;
      if (prefs[tm] !== s.defaultRepeat) overrides.add(tm);
    } else if (
      old &&
      groupEdits[tm] &&
      [...treatmentTimes(old), ...actualGroupTimes(s, old.id)].includes(tm)
    ) {
      prefs[tm] = groupIntervals[tm] ?? prefs[tm];
      overrides.add(tm);
    }
  }
  if (
    old &&
    JSON.stringify([
      old.name,
      old.kind,
      old.form,
      old.unit,
      old.detail,
      old.schedule,
      old.startDay,
      old.slots,
      old.intervalEvery,
      old.intervalUnit,
      old.weekdays,
      old.onDays,
      old.offDays,
    ]) ===
      JSON.stringify([
        t.name,
        t.kind,
        t.form,
        t.unit,
        t.detail,
        t.schedule,
        t.startDay,
        t.slots,
        t.intervalEvery,
        t.intervalUnit,
        t.weekdays,
        t.onDays,
        t.offDays,
      ])
  )
    return {
      ...s,
      treatments: s.treatments!.map((x) => (x.id === t.id ? t : x)),
      repeatPreferences: prefs,
      groupOverrides: [...overrides],
      groups: s.groups.map((g) =>
        futureGroup(s, g) &&
        !g.alerts &&
        g.items.some((i) => !g.records.some((r) => r.itemId === i.id))
          ? { ...g, interval: prefs[g.due % 1440] ?? g.interval }
          : g,
      ),
      events: [
        ...s.events,
        {
          at: s.now,
          groupId: "setup",
          text: `Saved preferences/manual stock · ${t.name}`,
        },
      ],
    };
  const scheduleChanged = old && !sameSchedule(old, t);
  const moves = (s.timeMoves ?? []).filter(
    (m) => !(scheduleChanged && m.treatmentId === t.id && m.scope === "future"),
  );
  const oldGroups = new Map(s.groups.map((g) => [s.clock ? g.id : g.due, g]));
  const oldReminders = new Map(
    s.groups.flatMap((g) =>
      g.items.map(
        (i) => [i.id, { due: g.due, reminder: g.reminders[i.id] }] as const,
      ),
    ),
  );
  const protectedItems: Item[] = [];
  const groups = s.groups
    .map((g) => {
      const keep = g.items
        .filter((i) => {
          if ((i.treatmentId ?? i.id) !== t.id) return true;
          const protectedItem =
            !futureItem(s, g, i) ||
            g.records.some((r) => r.itemId === i.id) ||
            moves.some((m) => m.scope === "one" && m.key === i.scheduledKey);
          if (protectedItem) protectedItems.push(i);
          return protectedItem;
        })
        .map((i) => {
          const slot = t.slots.find((slot) => slot.id === i.slotId);
          return i.treatmentId === t.id &&
            slot &&
            futureItem(s, g, i) &&
            !g.records.some((r) => r.itemId === i.id)
            ? {
                ...i,
                name: t.name,
                kind: t.kind,
                dose: dose(t, slot),
                quantity: slot.quantity,
                unit: t.unit,
              }
            : i;
        });
      return {
        ...g,
        items: keep,
        reminders: Object.fromEntries(
          keep.map((i) => [i.id, g.reminders[i.id]]),
        ),
        interval:
          futureGroup(s, g) &&
          !g.alerts &&
          g.items.some((i) => !g.records.some((r) => r.itemId === i.id))
            ? (prefs[g.due % 1440] ?? g.interval)
            : g.interval,
      };
    })
    .filter((g) => g.items.length || s.audit.some((a) => a.groupId === g.id));
  const end = Math.max(s.planHorizon ?? 1, Math.floor(s.now / 1440) + 31);
  const extra: Occurrence[] = [];
  for (let day = Math.floor(s.now / 1440); day <= end; day++)
    extra.push(
      ...planDay([t], day, prefs, moves, s.clock).filter((g) =>
        s.clock
          ? g.items.some((i) => i.alertInstant! >= s.clock!.instant)
          : g.due >= s.now,
      ),
    );
  return {
    ...s,
    treatments: [...(s.treatments ?? []).filter((x) => x.id !== t.id), t],
    repeatPreferences: prefs,
    groupOverrides: [...overrides],
    timeMoves: moves,
    planHorizon: end,
    groups: mergeGroups(groups, extra, s.now, protectedItems, s.clock).map(
      (g) => {
        const prior = oldGroups.get(s.clock ? g.id : g.due);
        return {
          ...g,
          ...(prior && prior.alerts
            ? {
                interval: prior.interval,
                alerts: prior.alerts,
                lastAlert: prior.lastAlert,
              }
            : {}),
          reminders: Object.fromEntries(
            g.items.map((i) => [
              i.id,
              oldReminders.get(i.id)?.due === g.due
                ? oldReminders.get(i.id)!.reminder
                : g.reminders[i.id],
            ]),
          ),
        };
      },
    ),
    events: [
      ...s.events,
      {
        at: s.now,
        groupId: "setup",
        text: `Saved ${old ? "edited" : "new"} treatment · ${t.name}`,
      },
    ],
  };
}
export function moveReminder(
  s: State,
  groupId: string,
  itemId: string,
  toDue: number,
  scope: "one" | "future",
  acceptProposal = false,
): State {
  const g = s.groups.find((g) => g.id === groupId),
    i = g?.items.find((i) => i.id === itemId),
    t = s.treatments?.find((t) => t.id === i?.treatmentId);
  if (s.clock && t?.schedule === "interval" && t.intervalUnit === "hours")
    return moveZonedHourly(s, groupId, itemId, toDue, scope);
  const next = moveReminderCore(
    s,
    groupId,
    itemId,
    toDue,
    scope,
    acceptProposal,
  );
  if (!s.clock) return next;
  return reconcileClock(next);
}
function moveReminderCore(
  s: State,
  groupId: string,
  itemId: string,
  toDue: number,
  scope: "one" | "future",
  acceptProposal = false,
): State {
  const source = s.groups.find((g) => g.id === groupId),
    item = source?.items.find((i) => i.id === itemId);
  if (!source || !item || source.records.some((r) => r.itemId === itemId))
    throw Error(
      "This reminder is no longer unrecorded. Reopen it from the overview.",
    );
  if (!scope) throw Error("Choose which reminders this change applies to.");
  if (!Number.isFinite(toDue) || !Number.isInteger(toDue))
    throw Error("Enter a valid reminder date/time.");
  if (Math.floor(toDue / 1440) < Math.floor(s.now / 1440))
    throw Error("Choose today or a future date.");
  const treatment = s.treatments?.find((t) => t.id === item.treatmentId);
  if (toDue === source.due) return s;
  if (
    scope === "future" &&
    !acceptProposal &&
    (Math.floor(toDue / 1440) !== Math.floor(source.due / 1440) ||
      (!s.clock &&
        treatment?.schedule === "interval" &&
        treatment.intervalUnit === "hours"))
  )
    throw Error(
      "Confirm the proposed future date-shift / hourly anchoring behavior, or choose This reminder only.",
    );
  if (
    scope === "future" &&
    (!item.treatmentId || !item.slotId || !item.scheduledKey)
  )
    throw Error(
      "This historical snapshot has no linked future treatment. Choose This reminder only.",
    );
  const rule: TimeMove = {
    key: item.scheduledKey ?? `historical|${source.id}|${item.id}`,
    treatmentId: item.treatmentId ?? `historical-${source.id}-${item.id}`,
    slotId: item.slotId ?? item.id,
    fromDue: item.scheduledKey
      ? Number(item.scheduledKey.split("|").at(-1))
      : source.due,
    toDue,
    scope,
  };
  const prefs = { ...s.repeatPreferences },
    minuteNew = toDue % 1440;
  if (prefs[minuteNew] === undefined) prefs[minuteNew] = source.interval;
  const extra: Occurrence[] = [];
  const groups = s.groups.map((g) => {
    const movable = g.items.filter(
      (i) =>
        !g.records.some((r) => r.itemId === i.id) &&
        ((g.id === groupId && i.id === itemId) ||
          (scope === "future" &&
            g.due >= source.due &&
            i.treatmentId === item.treatmentId &&
            i.slotId === item.slotId)),
    );
    for (const i of movable) {
      const due =
        g.id === groupId && i.id === itemId
          ? toDue
          : treatment?.schedule === "interval" &&
              treatment.intervalUnit === "hours"
            ? g.due + toDue - source.due
            : Math.floor(g.due / 1440) * 1440 +
              minuteNew +
              (Math.floor(toDue / 1440) - Math.floor(source.due / 1440)) * 1440;
      if (prefs[due % 1440] === undefined) prefs[due % 1440] = g.interval;
      extra.push({
        ...g,
        id: `${Math.floor(due / 1440)}-${due % 1440}`,
        due,
        items: [
          {
            ...i,
            id: i.treatmentId ? i.id : `historical|${g.id}|${i.id}`,
            movedFrom: i.movedFrom ?? g.due,
            alertInstant: undefined,
          },
        ],
        records: [],
        interval: prefs[due % 1440],
        alerts: 0,
        lastAlert: null,
        reminders: {
          [i.id]: {
            next: Math.max(due, s.now),
            visible: due <= s.now,
            snoozedUntil: null,
          },
        },
      });
    }
    const keep = g.items.filter((i) => !movable.includes(i));
    return {
      ...g,
      items: keep,
      reminders: Object.fromEntries(keep.map((i) => [i.id, g.reminders[i.id]])),
    };
  });
  return {
    ...s,
    audit: s.audit.map((a) =>
      a.groupId === source.id && a.itemId === itemId
        ? {
            ...a,
            itemName: a.itemName ?? item.name,
            dose: a.dose ?? item.dose,
            scheduledDue: a.scheduledDue ?? source.due,
          }
        : a,
    ),
    repeatPreferences: prefs,
    timeMoves: [
      ...(s.timeMoves ?? [])
        .filter(
          (m) =>
            !(
              (scope === "one" || !!s.clock) &&
              m.scope === "one" &&
              m.key === rule.key
            ),
        )
        .map((m) =>
          !s.clock &&
          scope === "future" &&
          m.scope === "one" &&
          m.treatmentId === rule.treatmentId &&
          m.slotId === rule.slotId &&
          m.fromDue >= rule.fromDue &&
          m.toDue >= source.due
            ? {
                ...m,
                toDue:
                  treatment?.schedule === "interval" &&
                  treatment.intervalUnit === "hours"
                    ? m.toDue + toDue - source.due
                    : Math.floor(m.toDue / 1440) * 1440 +
                      minuteNew +
                      (Math.floor(toDue / 1440) -
                        Math.floor(source.due / 1440)) *
                        1440,
              }
            : m,
        ),
      rule,
    ],
    groups: mergeGroups(groups, extra, s.now, [], s.clock),
    events: [
      ...s.events,
      {
        at: s.now,
        groupId: source.id,
        text: `Changed date/time only · ${item.name} · ${scope === "one" ? "This reminder only" : "This and future reminders in this administration slot"}`,
      },
    ],
  };
}
export const startDate = (t: Treatment) =>
  Number.isFinite(t.startDay) ? isoDay(t.startDay) : "";
