
import { epoch } from "./calendar";
export type Clock = {
  zone: string;
  instant: number;
  anchors: Record<string, number>;
};
export const zones = [
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Lord_Howe",
  "UTC",
];
const formatters = new Map<string, Intl.DateTimeFormat>(),
  resolved = new Map<
    string,
    { instant: number; wall: number; gap: boolean; fold: boolean }
  >();
function formatter(zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    if (formatters.size > 100) formatters.clear();
    formatters.set(zone, f);
  }
  return f;
}
export function wallAt(instant: number, zone: string): number {
  const p = Object.fromEntries(
    formatter(zone)
      .formatToParts(new Date(instant))
      .map((x) => [x.type, x.value]),
  );
  return Math.round(
    (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - epoch) /
      60000,
  );
}
export function resolveWall(wall: number, zone: string) {
  if (!Number.isInteger(wall)) throw Error("Enter a valid local date/time.");
  const key = `${zone}|${wall}`,
    cached = resolved.get(key);
  if (cached) return cached;
  const nominal = epoch + wall * 60000,
    offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const u = nominal + hours * 3600000;
    offsets.add(epoch + wallAt(u, zone) * 60000 - u);
  }
  const candidates = [...offsets]
      .map((offset) => nominal - offset)
      .sort((a, b) => a - b),
    exact = candidates.filter((u) => wallAt(u, zone) === wall);
  let instant = exact[0];
  if (instant === undefined) {
    for (let u = candidates[0]; u <= candidates.at(-1)!; u += 60000)
      if (wallAt(u, zone) >= wall) {
        instant = u;
        break;
      }
  }
  if (instant === undefined)
    throw Error(
      "This local date/time cannot be resolved in the selected time zone.",
    );
  const result = {
    instant,
    wall: wallAt(instant, zone),
    gap: !exact.length,
    fold: exact.length > 1,
  };
  if (resolved.size > 10000) resolved.clear();
  resolved.set(key, result);
  return result;
}
