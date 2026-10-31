import type { ListColor } from "@wuff/contracts";
import { listThemeVariables, todoThemeVariables } from "@wuff/design";
export { listThemeVariables } from "@wuff/design";

export function applyListTheme(
  color: ListColor,
  target: HTMLElement,
  productivity = false,
) {
  for (const [key, value] of Object.entries(
    productivity
      ? todoThemeVariables(
          color,
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        )
      : listThemeVariables(color),
  ))
    target.style.setProperty(key, value);
  target.dataset.listTheme = color;
  target.style.colorScheme = productivity
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : "light";
}
