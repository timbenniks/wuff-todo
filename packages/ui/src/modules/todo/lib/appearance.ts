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
export function readTodoAppearance(): TodoAppearance {
  try {
    return parseTodoAppearance(localStorage.getItem(todoAppearanceKey));
  } catch {
    return fallback;
  }
}
export function setTodoAppearance(value: TodoAppearance) {
  fallback = value;
  try {
    localStorage.setItem(todoAppearanceKey, value);
  } catch {
    /* Current document remains usable. */
  }
  window.dispatchEvent(new Event(todoAppearanceEvent));
}
