import type { State } from "./model";
import type { Treatment } from "./treatments";
import { forecast, type Forecast } from "./stock";
export const isLowStock = (t: Treatment) =>
  t.inventory.enabled &&
  Number(t.inventory.current) <= Number(t.inventory.threshold);
export function warningDetails(t: Treatment, f: Forecast, now: number) {
  if (!isLowStock(t)) return null;
  const days =
    t.schedule !== "prn" && f.runOutDay !== undefined
      ? Math.max(0, f.runOutDay - Math.floor(now / 1440))
      : undefined;
  const countdown =
    days === undefined
      ? undefined
      : days === 0
        ? "runs out today"
        : `runs out in ~${days} day${days === 1 ? "" : "s"}`;
  return {
    id: t.id,
    name: t.name,
    tone: f.insufficient ? ("danger" as const) : ("warning" as const),
    days,
    countdown,
  };
}
export function lowStockWarnings(s: State) {
  return (s.treatments ?? [])
    .filter(isLowStock)
    .map((t) => warningDetails(t, forecast(s, t), s.now)!);
}
export function warningStrip(warnings: ReturnType<typeof lowStockWarnings>) {
  if (!warnings.length) return null;
  if (warnings.length > 1)
    return {
      text: `${warnings.length} items low on stock · View`,
      tone: warnings.some((w) => w.tone === "danger") ? "danger" : "warning",
    };
  const w = warnings[0];
  return {
    text: `${w.tone === "danger" ? "Insufficient stock" : "Low stock"} · ${w.name}${w.countdown ? " · " + w.countdown : ""} · View`,
    tone: w.tone,
  };
}
