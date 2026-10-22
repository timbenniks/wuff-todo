// A due date is a calendar label, not a timestamp. Only "today" depends on the
// viewer's clock. Explicit UTC formatting preserves the date across locales/zones
// and keeps server-rendered text identical to the first client render.
export function calendarDay(offset = 0, now = new Date()) {
  const day = new Date(now);
  day.setDate(day.getDate() + offset);
  return `${String(day.getFullYear()).padStart(4, "0")}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}
export function nextCalendarDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function formatDueDate(day: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function dueDatePresentation(
  day: string,
  completed: boolean,
  today: string | null,
) {
  const date = formatDueDate(day);
  if (completed)
    return {
      label: date,
      tone: "muted",
      detail: `Completed · Due date kept: ${date}. A fetching finish!`,
    } as const;
  if (today && day < today)
    return {
      label: `Overdue · ${date}`,
      tone: "overdue",
      detail: `Due ${date}. This task needs a paw.`,
    } as const;
  if (day === today)
    return {
      label: "Due today",
      tone: "today",
      detail: `Due ${date}. A fetching day to finish!`,
    } as const;
  if (today && day === nextCalendarDay(today))
    return {
      label: "Due tomorrow",
      tone: "muted",
      detail: `Due ${date}. Stay a paw ahead!`,
    } as const;
  return {
    label: date,
    tone: "muted",
    detail: `Due ${date}. On your pack’s calendar.`,
  } as const;
}
