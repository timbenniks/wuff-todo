export type TodoAppearance = "light" | "dark" | "system";
export const todoAppearanceKey = "wuff:todo:appearance:v1";
export const todoAppearanceEvent = "wuff:todo:appearance";
export function parseTodoAppearance(value: unknown): TodoAppearance {
  return value === "dark" || value === "system" ? value : "light";
}
export function isTodoDark(appearance: TodoAppearance, systemDark: boolean) {
  return appearance === "dark" || (appearance === "system" && systemDark);
}
let fallback: TodoAppearance = "light";
let writeUnavailable = false;
export function readTodoAppearance(event?: {
  type: string;
  key?: string | null;
}): TodoAppearance {
  if (
    event?.type === "storage" &&
    (event.key === todoAppearanceKey || event.key === null)
  )
    writeUnavailable = false;
  if (writeUnavailable) return fallback;
  try {
    fallback = parseTodoAppearance(localStorage.getItem(todoAppearanceKey));
    return fallback;
  } catch {
    return fallback;
  }
}
export function setTodoAppearance(value: TodoAppearance) {
  fallback = value;
  try {
    localStorage.setItem(todoAppearanceKey, value);
    writeUnavailable = false;
  } catch {
    writeUnavailable = true;
  }
  window.dispatchEvent(new Event(todoAppearanceEvent));
}
