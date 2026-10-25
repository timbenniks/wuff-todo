export type NotesRequest = { path: string; method: string; body: unknown };
export function uncertainNotesError(error: unknown) {
  const e = error as { status?: number; code?: string };
  if (e.code === "images_unavailable") return false;
  return !e.status || e.status >= 500 || e.code === "internal_error";
}
export function canReplaceNoteDraft(
  dirty: boolean,
  pending: boolean,
  busy: boolean,
) {
  return !dirty && !pending && !busy;
}
export function moveNoteCard(
  ids: readonly string[],
  id: string,
  direction: -1 | 1,
) {
  const next = [...ids],
    from = next.indexOf(id),
    to = from + direction;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// SSR and browser hydration must render the same calendar date.
export function noteDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}
