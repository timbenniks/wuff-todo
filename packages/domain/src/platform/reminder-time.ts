
import { Temporal } from "@js-temporal/polyfill";
import type { ReminderPreferences } from "@wuff/contracts";
export function reminderLocalDay(now: Date, timezone: string) {
  return Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export function localReminderInstant(local: string, timezone: string) {
  return new Date(
    Temporal.PlainDateTime.from(local).toZonedDateTime(timezone, {
      disambiguation: "compatible",
    }).epochMilliseconds,
  );
}
export function nextDailyReminder(now: Date, preferences: ReminderPreferences) {
  const zoned = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
    preferences.timezone,
  );
  let date = zoned.toPlainDate();
  let candidate = date
    .toPlainDateTime(preferences.dailyTime)
    .toZonedDateTime(preferences.timezone);
  if (candidate.epochMilliseconds <= now.getTime())
    candidate = date
      .add({ days: 1 })
      .toPlainDateTime(preferences.dailyTime)
      .toZonedDateTime(preferences.timezone);
  return respectQuietHours(new Date(candidate.epochMilliseconds), preferences);
}
export function respectQuietHours(instant: Date, p: ReminderPreferences) {
  if (!p.quietEnabled) return instant;
  const zoned = Temporal.Instant.from(instant.toISOString()).toZonedDateTimeISO(
    p.timezone,
  );
  const time = zoned.toPlainTime().toString().slice(0, 5);
  const overnight = p.quietStart > p.quietEnd;
  const quiet = overnight
    ? time >= p.quietStart || time < p.quietEnd
    : time >= p.quietStart && time < p.quietEnd;
  if (!quiet) return instant;
  const date =
    overnight && time >= p.quietStart
      ? zoned.toPlainDate().add({ days: 1 })
      : zoned.toPlainDate();
  return new Date(
    date.toPlainDateTime(p.quietEnd).toZonedDateTime(p.timezone)
      .epochMilliseconds,
  );
}
