import { reconcileClock, snoozeClock, undoClock } from "./zonedScheduler";
import { resolveWall, type Clock } from "./timeZone";
import { deduct, restore, type StockState } from "./stock";
import { fullDate } from "./calendar";
import { extendSchedule } from "./treatments";
import type { Treatment, TimeMove } from "./treatments";
export type Item = {
  id: string;
  name: string;
  dose: string;
  quantity?: string;
  unit?: string;
  kind: "medication" | "equipment";
  treatmentId?: string;
  slotId?: string;
  scheduledKey?: string;
  originDay?: number;
  seriesIndex?: number;
  hourly?: boolean;
  movedFrom?: number;
  alertInstant?: number;
  sensorInsertion?: boolean;
  scheduledZone?: string;
};
export type RecordEntry = {
  id: string;
  itemId: string;
  outcome: "taken" | "skipped";
  at: number;
  atInstant?: number;
  zone?: string;
  insertion?: boolean;
  scheduledTime?: number;
  scheduledZone?: string;
};
export type ItemReminder = {
  next: number;
  snoozedUntil: number | null;
  visible: boolean;
  nextInstant?: number;
  snoozedInstant?: number | null;
  started?: boolean;
};
export type Occurrence = {
  id: string;
  due: number;
  title: string;
  items: Item[];
  records: RecordEntry[];
  interval: number;
  reminders: Record<string, ItemReminder>;
  alerts: number;
  lastAlert: number | null;
  lastAlertInstant?: number;
};
export type AuditEntry = {
  atInstant?: number;
  zone?: string;
  scheduledZone?: string;
  alertInstant?: number;
  itemName?: string;
  dose?: string;
  scheduledDue?: number;
  id: string;
  recordId: string;
  at: number;
  action: "record" | "undo";
  groupId: string;
  itemId: string;
  outcome: "taken" | "skipped";
};
export type State = {
  intakes?: import("./oneTime").Intake[];
  clock?: Clock;
  stock?: StockState;
  treatments?: Treatment[];
  planHorizon?: number;
  timeMoves?: TimeMove[];
  groupOverrides?: number[];
  defaultRepeat: number;
  audit: AuditEntry[];
  now: number;
  repeatPreferences: Record<number, number>;
  groups: Occurrence[];
  events: { at: number; text: string; groupId: string }[];
};
export const pending = (g: Occurrence) =>
  g.items.filter((i) => !g.records.some((r) => r.itemId === i.id));
/** Presentation status uses the same original scheduled instant on every surface. Snooze never changes it. */
export function reminderTiming(
  s: State,
  g: Occurrence,
): "overdue" | "due" | "scheduled" | "recorded" {
  const items = pending(g);
  if (!items.length) return "recorded";
  const now = s.clock?.instant ?? s.now;
  const dues = items.map((i) =>
    s.clock
      ? (i.alertInstant ?? resolveWall(g.due, s.clock.zone).instant)
      : g.due,
  );
  return dues.some((at) => at < now)
    ? "overdue"
    : dues.some((at) => at === now)
      ? "due"
      : "scheduled";
}
export const alerting = (g: Occurrence) =>
  pending(g).filter((i) => g.reminders[i.id].visible);
export const nextAlert = (g: Occurrence) =>
  Math.min(...pending(g).map((i) => g.reminders[i.id].next));
export const time = (n: number) => {
  const m = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export const date = (n: number) => fullDate(Math.floor(n / 1440));
export function record(
  s: State,
  id: string,
  ids: string[],
  outcome: RecordEntry["outcome"],
): State {
  const g = s.groups.find((g) => g.id === id);
  if (!g) return s;
  const accepted = pending(g).filter((i) => ids.includes(i.id));
  if (!accepted.length) return s;
  const added = accepted.map((i, index) => ({
    id: `record-${s.audit.length + index + 1}`,
    itemId: i.id,
    outcome,
    at: s.now,
    ...(s.clock
      ? {
          atInstant: s.clock.instant,
          zone: s.clock.zone,
          scheduledTime: g.due,
          scheduledZone: i.scheduledZone,
        }
      : {}),
    ...(i.sensorInsertion ? { insertion: true } : {}),
  }));
  const records = [...g.records, ...added];
  const audit: AuditEntry[] = added.map((r) => ({
    id: `audit-${r.id}`,
    recordId: r.id,
    at: s.now,
    action: "record",
    groupId: g.id,
    itemId: r.itemId,
    outcome,
    itemName: g.items.find((i) => i.id === r.itemId)!.name,
    dose: g.items.find((i) => i.id === r.itemId)!.dose,
    scheduledDue: g.due,
    ...(s.clock
      ? {
          atInstant: s.clock.instant,
          zone: s.clock.zone,
          scheduledZone: g.items.find((i) => i.id === r.itemId)!.scheduledZone,
          alertInstant: g.items.find((i) => i.id === r.itemId)!.alertInstant,
        }
      : {}),
  }));
  let next: State = {
    ...s,
    audit: [...s.audit, ...audit],
    groups: s.groups.map((x) => (x.id === id ? { ...g, records } : x)),
    events: [
      ...s.events,
      {
        at: s.now,
        text: `${accepted.length} recorded as ${outcome === "taken" ? "taken/done" : "skipped"} · ${g.title}`,
        groupId: id,
      },
    ],
  };
  if (outcome === "taken")
    for (const r of added)
      next = deduct(
        next,
        accepted.find((i) => i.id === r.itemId)!,
        r.id,
        g.id,
        g.due,
      );
  return reconcileClock(next);
}
export function snooze(
  s: State,
  id: string,
  ids: string[],
  minutes: number,
): State {
  if (![15, 30, 45, 60].includes(minutes)) return s;
  const g = s.groups.find((g) => g.id === id);
  if (!g) return s;
  const accepted = pending(g).filter((i) => ids.includes(i.id));
  if (!accepted.length) return s;
  const reminders = { ...g.reminders };
  for (const i of accepted)
    reminders[i.id] = {
      next: s.now + minutes,
      snoozedUntil: s.now + minutes,
      visible: false,
    };
  const next = {
    ...s,
    groups: s.groups.map((x) => (x.id === id ? { ...g, reminders } : x)),
    events: [
      ...s.events,
      {
        at: s.now,
        text: `Snoozed ${accepted.length} selected items for ${minutes} minutes · ${g.title}`,
        groupId: id,
      },
    ],
  };
  return s.clock
    ? snoozeClock(
        next,
        id,
        accepted.map((i) => i.id),
        minutes,
      )
    : next;
}
export function dismiss(s: State, id: string): State {
  return {
    ...s,
    groups: s.groups.map((g) =>
      g.id === id
        ? {
            ...g,
            reminders: Object.fromEntries(
              Object.entries(g.reminders).map(([key, r]) => [
                key,
                { ...r, visible: false },
              ]),
            ),
          }
        : g,
    ),
  };
}

export function undo(s: State, groupId: string, recordId: string): State {
  const g = s.groups.find((g) => g.id === groupId),
    r = g?.records.find((r) => r.id === recordId);
  if (!g || !r) return s;
  const due = g.due <= s.now;
  const restored = {
    next: due ? s.now : g.due,
    snoozedUntil: null,
    visible: due,
  };
  const next = restore(
    {
      ...s,
      groups: s.groups.map((x) =>
        x.id === g.id
          ? {
              ...g,
              records: g.records.filter((x) => x.id !== recordId),
              reminders: { ...g.reminders, [r.itemId]: restored },
            }
          : x,
      ),
      audit: [
        ...s.audit,
        {
          id: `undo-${s.audit.length + 1}`,
          recordId: r.id,
          at: s.now,
          action: "undo",
          groupId: g.id,
          itemId: r.itemId,
          outcome: r.outcome,
          itemName: g.items.find((i) => i.id === r.itemId)!.name,
          dose: g.items.find((i) => i.id === r.itemId)!.dose,
          scheduledDue: g.due,
        },
      ],
      events: [
        ...s.events,
        {
          at: s.now,
          groupId: g.id,
          text: `Undo ${r.outcome} · ${g.items.find((i) => i.id === r.itemId)!.name} · original record ${r.id}`,
        },
      ],
    },
    recordId,
  );
  return s.clock ? reconcileClock(undoClock(next, groupId, r.itemId)) : next;
}
export function ensureDay(s: State, day: number): State {
  return extendSchedule(s, day + 1);
}
export function dayStatus(
  s: State,
  day: number,
): "all-recorded" | "unrecorded" | "neutral" {
  const groups = s.groups.filter(
    (g) => Math.floor(g.due / 1440) === day && g.items.length,
  );
  if (!groups.length || day > Math.floor(s.now / 1440)) return "neutral";
  if (groups.every((g) => !pending(g).length)) return "all-recorded";
  return day < Math.floor(s.now / 1440) ? "unrecorded" : "neutral";
}
export function saveDefaultRepeat(s: State, minutes: number): State {
  if (![5, 10, 15, 20, 30].includes(minutes)) return s;
  const prefs = { ...s.repeatPreferences };
  for (const key of Object.keys(prefs).map(Number))
    if (!s.groupOverrides?.includes(key)) prefs[key] = minutes;
  return {
    ...s,
    defaultRepeat: minutes,
    repeatPreferences: prefs,
    groups: s.groups.map((g) =>
      (s.clock
        ? g.items.every((i) => i.alertInstant! > s.clock!.instant)
        : g.due > s.now) &&
      !g.alerts &&
      g.items.some((i) => !g.records.some((r) => r.itemId === i.id)) &&
      !s.groupOverrides?.includes(g.due % 1440)
        ? { ...g, interval: minutes }
        : g,
    ),
  };
}
