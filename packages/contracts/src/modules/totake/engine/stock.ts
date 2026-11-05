import { count, countText } from "./count";
import type { Item, State } from "./model";
import { planDay, type Treatment } from "./treatments";
import { fullDate } from "./calendar";
export type StockMovement = {
  id: string;
  treatmentId: string;
  name: string;
  at: number;
  kind: "opening" | "taken" | "undo" | "add" | "correct";
  delta: number;
  balance: number;
  deltaExact?: string;
  balanceExact?: string;
  unit: string;
  recordId?: string;
  groupId?: string;
  scheduledDue?: number;
  reverses?: string;
};
export type StockState = {
  movements: StockMovement[];
  low: Record<string, boolean>;
  refills: {
    id: string;
    treatmentId: string;
    name: string;
    at: number;
    balance: number;
    threshold: number;
    unit: string;
    resolvedAt?: number;
  }[];
};
export const rounded = (n: number) =>
  Math.round((n + Number.EPSILON) * 1e12) / 1e12;
export function amount(value: string, positive = false): number {
  const n = count(value);
  if (positive ? n <= 0n : n < 0n)
    throw Error(`Enter ${positive ? "a positive" : "a non-negative"} count.`);
  return Number(value);
}
const unitKey = (unit: string) => {
  const key = unit.trim().toLowerCase();
  const units = [
    "tablet",
    "pill",
    "capsule",
    "sachet",
    "sensor",
    "catheter",
    "set",
    "item",
    "drop",
    "puff",
    "patch",
    "unit",
    "microgram",
  ];
  return units.includes(key.replace(/s$/, "")) ? key.replace(/s$/, "") : key;
};
export const sameUnit = (a: string, b: string) => unitKey(a) === unitKey(b);
export const stockState = (s: State): StockState =>
  s.stock ?? { movements: [], low: {}, refills: [] };
export function quantity(item: Item): number {
  const raw =
    item.quantity ?? item.dose.match(/^(?:Replace\s+)?([\d.]+)\s/)?.[1];
  if (!raw)
    throw Error(
      `No reliable stock quantity for ${item.name}. Edit the scheduled quantity first.`,
    );
  return amount(raw, true);
}
export function syncRefills(s: State): State {
  if (!s.stock && !s.treatments?.some((t) => t.inventory.enabled)) return s;
  const stock = stockState(s),
    low = { ...stock.low },
    refills = stock.refills.map((r) => ({ ...r }));
  for (const t of s.treatments ?? []) {
    const isLow =
      t.inventory.enabled &&
      Number(t.inventory.current) <= Number(t.inventory.threshold);
    if (isLow && !low[t.id])
      refills.push({
        id: `refill-${refills.length + 1}`,
        treatmentId: t.id,
        name: t.name,
        at: s.now,
        balance: Number(t.inventory.current),
        threshold: Number(t.inventory.threshold),
        unit: t.inventory.unit,
      });
    if (!isLow)
      for (const r of refills)
        if (r.treatmentId === t.id && r.resolvedAt === undefined)
          r.resolvedAt = s.now;
    low[t.id] = isLow;
  }
  return { ...s, stock: { ...stock, low, refills } };
}
function movement(
  s: State,
  treatmentId: string,
  delta: number | string,
  entry: Omit<
    StockMovement,
    "balance" | "unit" | "treatmentId" | "delta" | "name" | "at"
  >,
): State {
  const t = s.treatments?.find((t) => t.id === treatmentId);
  if (!t)
    throw Error("The linked stock item is unavailable. Nothing was saved.");
  const deltaExact =
    typeof delta === "string"
      ? countText(count(delta))
      : countText(count(String(delta)));
  const balanceExact = countText(
    count(t.inventory.current) + count(deltaExact),
  );
  count(balanceExact);
  const balance = Number(balanceExact);

  return {
    ...s,
    treatments: s.treatments!.map((x) =>
      x.id === treatmentId
        ? { ...x, inventory: { ...x.inventory, current: balanceExact } }
        : x,
    ),
    stock: {
      ...stockState(s),
      movements: [
        ...stockState(s).movements,
        {
          ...entry,
          treatmentId,
          name: t.name,
          at: s.now,
          delta: Number(deltaExact),
          balance,
          deltaExact,
          balanceExact,
          unit: t.inventory.unit,
        },
      ],
    },
  };
}
export function deduct(
  s: State,
  item: Item,
  recordId: string,
  groupId: string,
  scheduledDue?: number,
): State {
  const t = s.treatments?.find((t) => t.id === item.treatmentId);
  if (!t?.inventory.enabled) return s;
  if (stockState(s).movements.some((m) => m.id === `stock-${recordId}`))
    return s;
  if (
    !sameUnit(
      t.inventory.unit,
      item.unit ??
        item.dose
          .replace(/^Replace\s+/, "")
          .split(" · ")[0]
          .replace(/^[\d.]+\s+/, ""),
    )
  )
    throw Error(
      `Stock unit and dose unit differ for ${item.name}. Match the units in Edit; no conversion is assumed.`,
    );
  return syncRefills(
    movement(
      s,
      t.id,
      countText(-count(item.quantity ?? String(quantity(item)))),
      {
        id: `stock-${recordId}`,
        kind: "taken",
        recordId,
        groupId,
        scheduledDue,
      },
    ),
  );
}
export function restore(s: State, recordId: string): State {
  const stock = stockState(s),
    m = stock.movements.find(
      (m) => m.kind === "taken" && m.recordId === recordId,
    );
  if (!m || stock.movements.some((x) => x.reverses === m.id)) return s;
  return syncRefills(
    movement(
      s,
      m.treatmentId,
      countText(-count(m.deltaExact ?? String(m.delta))),
      {
        id: `restore-${recordId}`,
        kind: "undo",
        recordId,
        groupId: m.groupId,
        scheduledDue: m.scheduledDue,
        reverses: m.id,
      },
    ),
  );
}
export function adjustStock(
  s: State,
  id: string,
  kind: "add" | "correct",
  value: string,
  operationId: string,
): State {
  if (stockState(s).movements.some((m) => m.id === operationId)) return s;
  const t = s.treatments?.find((t) => t.id === id);
  if (!t?.inventory.enabled)
    throw Error("Enable stock tracking in Edit first.");
  amount(value, kind === "add");
  const delta =
    kind === "add"
      ? value
      : countText(count(value) - count(t.inventory.current));
  return syncRefills(movement(s, id, delta, { id: operationId, kind }));
}
/** Settings edits and first enable are explicit balance snapshots; never replay old dose records. */
export function stockSetup(before: State, after: State, t: Treatment): State {
  const old = before.treatments?.find((x) => x.id === t.id);
  const stock = stockState(after);
  if (
    old &&
    stock.movements.some((m) => m.treatmentId === t.id) &&
    !sameUnit(old.inventory.unit, t.inventory.unit)
  )
    throw Error(
      "Keep the stock unit unchanged once movements exist. Unit conversion needs a separate reviewed flow.",
    );
  if (!t.inventory.enabled) return syncRefills(after);
  amount(t.inventory.threshold);
  if (
    !old ||
    old.inventory.current !== t.inventory.current ||
    !old.inventory.enabled
  )
    amount(t.inventory.current);
  if (!sameUnit(t.inventory.unit, t.unit))
    throw Error(
      "Use the same stock unit and dose/quantity unit. Unit conversion is not implemented.",
    );
  if (old?.inventory.enabled && old.inventory.current === t.inventory.current)
    return syncRefills(after);
  const deltaExact = countText(
    count(t.inventory.current) - (old ? count(old.inventory.current) : 0n),
  );
  const delta = Number(deltaExact);
  const entry: StockMovement = {
    id: `setup-stock-${stock.movements.length + 1}`,
    treatmentId: t.id,
    name: t.name,
    at: after.now,
    kind: !old?.inventory.enabled ? "opening" : "correct",
    delta,
    deltaExact,
    balanceExact: t.inventory.current,
    balance: Number(t.inventory.current),
    unit: t.inventory.unit,
  };
  return syncRefills({
    ...after,
    stock: { ...stock, movements: [...stock.movements, entry] },
  });
}
export type Forecast = {
  label: string;
  overdue: number;
  reason?: string;
  runOutDay?: number;
  insufficient?: boolean;
};
export function forecast(s: State, t: Treatment): Forecast {
  const none = (reason: string, overdue = 0): Forecast => ({
    label: "No estimate available",
    reason,
    overdue,
  });
  if (t.schedule === "prn")
    return { label: "As needed · no run-out estimate", overdue: 0 };
  if (!sameUnit(t.inventory.unit, t.unit))
    return none(
      "Stock and administration units differ; no conversion is assumed.",
    );
  if (
    !["daily", "twice", "multiple", "weekdays", "interval", "cycle"].includes(
      t.schedule,
    ) ||
    !Number.isInteger(t.startDay) ||
    !t.slots.length ||
    t.slots.some((slot) => !/^\d{2}:\d{2}$/.test(slot.time))
  )
    return none("The saved schedule cannot be projected reliably.");
  if (
    (t.schedule === "cycle" &&
      (t.onDays < 1 || t.offDays < 1 || !t.proposalAccepted)) ||
    (t.schedule === "interval" &&
      (t.intervalEvery < 1 || !Number.isInteger(t.intervalEvery))) ||
    (t.schedule === "weekdays" && !t.weekdays.length)
  )
    return none(
      "The saved interval/cycle/weekday rule is incomplete or unconfirmed.",
    );
  let overdue = 0;
  const future = new Map<string, { due: number; qty: number; order: number }>(),
    known = new Set<string>();
  try {
    for (const g of s.groups)
      for (const i of g.items)
        if (i.treatmentId === t.id) {
          known.add(i.id);
          if (g.records.some((r) => r.itemId === i.id)) continue;
          const q = quantity(i);
          if (s.clock ? i.alertInstant! < s.clock.instant : g.due < s.now)
            overdue = rounded(overdue + q);
          else
            future.set(i.id, {
              due: g.due,
              qty: q,
              order: s.clock ? i.alertInstant! : g.due,
            });
        }
    // Most stock runs out inside the authoritative planned window. Avoid resolving
    // ten years of timezone instants on every render when the result is already known.
    const early = [...future.values()].sort((a, b) => a.order - b.order);
    let remaining = Number(t.inventory.current),
      covered: number | undefined;
    for (const a of early) {
      if (remaining < a.qty)
        return covered === undefined
          ? {
              label: `Insufficient stock for the next scheduled ${t.kind === "equipment" ? "change" : "dose"}`,
              overdue,
              insufficient: true,
            }
          : {
              label: `Estimated to run out: ${fullDate(Math.floor(covered / 1440))}`,
              overdue,
              runOutDay: Math.floor(covered / 1440),
            };
      remaining = rounded(remaining - a.qty);
      covered = a.due;
    }
    const horizon = Math.floor(s.now / 1440) + 3660;
    // Existing planned occurrences are authoritative. Project only new origin days,
    // using the same saved schedule and scoped moves as the reminder planner.
    for (
      let day = Math.max(
        (s.planHorizon ?? Math.floor(s.now / 1440)) + 1,
        t.startDay,
      );
      day <= horizon;
      day++
    )
      for (const g of planDay(
        [t],
        day,
        s.repeatPreferences,
        s.timeMoves,
        s.clock,
      ))
        for (const i of g.items)
          if (
            (s.clock ? i.alertInstant! >= s.clock.instant : g.due >= s.now) &&
            !known.has(i.id)
          )
            future.set(i.id, {
              due: g.due,
              qty: quantity(i),
              order: s.clock ? i.alertInstant! : g.due,
            });
    let balance = Number(t.inventory.current),
      last: number | undefined;
    const entries = [...future.values()].sort((a, b) => a.order - b.order);
    for (const a of entries) {
      if (balance < a.qty)
        return last === undefined
          ? {
              label: `Insufficient stock for the next scheduled ${t.kind === "equipment" ? "change" : "dose"}`,
              overdue,
              insufficient: true,
            }
          : {
              label: `Estimated to run out: ${fullDate(Math.floor(last / 1440))}`,
              overdue,
              runOutDay: Math.floor(last / 1440),
            };
      balance = rounded(balance - a.qty);
      last = a.due;
    }
    if (balance === 0 && last !== undefined)
      return {
        label: `Estimated to run out: ${fullDate(Math.floor(last / 1440))}`,
        overdue,
        runOutDay: Math.floor(last / 1440),
      };
    return none(
      "No depletion date within the 10-year projection window.",
      overdue,
    );
  } catch (e) {
    return none(
      e instanceof Error
        ? e.message
        : "The schedule cannot be projected reliably.",
      overdue,
    );
  }
}
