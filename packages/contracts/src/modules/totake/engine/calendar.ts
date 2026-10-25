
import { displayISO } from "./dateFormat";
export const epoch = Date.UTC(1970, 0, 1);
export const dayDate = (day: number) => new Date(epoch + day * 86400000);
export const isoDay = (day: number) => dayDate(day).toISOString().slice(0, 10);
export const weekStart = (day: number) =>
  day - ((dayDate(day).getUTCDay() + 6) % 7);
export const monthStart = (day: number) => day - dayDate(day).getUTCDate() + 1;
export const monthShift = (day: number, offset: number) =>
  Math.round(
    (Date.UTC(
      dayDate(day).getUTCFullYear(),
      dayDate(day).getUTCMonth() + offset,
      1,
    ) -
      epoch) /
      86400000,
  );
export const monthGrid = (day: number) =>
  Array.from({ length: 42 }, (_, i) => weekStart(monthStart(day)) + i);
export const monthLabel = (day: number) =>
  dayDate(day).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
export const fullDate = (day: number) =>
  Number.isFinite(day) ? displayISO(isoDay(day)) : "";
