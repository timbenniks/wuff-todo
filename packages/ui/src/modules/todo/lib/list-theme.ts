import type { ListColor } from "@wuff/contracts";
import { listThemeVariables, todoThemeVariables } from "@wuff/design";
import { readTodoAppearance, isTodoDark } from "./appearance";
export { listThemeVariables } from "@wuff/design";

export function applyListTheme(
  color: ListColor,
  target: HTMLElement,
  productivity = false,
) {
  const dark =
    productivity &&
    isTodoDark(
      readTodoAppearance(),
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  for (const [key, value] of Object.entries(
    productivity ? todoThemeVariables(color, dark) : listThemeVariables(color),
  ))
    target.style.setProperty(key, value);
  target.dataset.listTheme = color;
  target.style.colorScheme = dark ? "dark" : "light";
  if (productivity) target.dataset.todoAppearance = dark ? "dark" : "light";
  else delete target.dataset.todoAppearance;
}
