import type { ListColor } from "@wuff/contracts";
import { listThemeVariables } from "@wuff/design";
export { listThemeVariables } from "@wuff/design";

export function applyListTheme(color: ListColor, target: HTMLElement) {
  for (const [key, value] of Object.entries(listThemeVariables(color)))
    target.style.setProperty(key, value);
  target.dataset.listTheme = color;
}
