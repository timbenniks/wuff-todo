import type { ListColor } from "@wuff/contracts";
import { listPalette } from "./list-colors";

// Mix opaque sRGB colors so web and the standalone MCP document use identical
// values, including browsers that do not support relative-color syntax.
function mix(a: string, b: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - amount) +
            parseInt(b.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function listThemeVariables(
  color: ListColor,
): Record<`--wuff-${string}`, string> {
  const accent = listPalette[color].accent;
  return {
    "--wuff-primary": accent,
    "--wuff-primary-hover": mix(accent, "#000000", 0.12),
    "--wuff-background": mix(accent, "#ffffff", 0.97),
    "--wuff-surface": mix(accent, "#ffffff", 0.995),
    "--wuff-sidebar": mix(accent, "#ffffff", 0.91),
    "--wuff-accent": mix(accent, "#ffffff", 0.9),
    "--wuff-foreground": mix(accent, "#17202a", 0.72),
    "--wuff-muted": mix(accent, "#35404b", 0.6),
    "--wuff-border": mix(accent, "#ffffff", 0.78),
    "--wuff-control": mix(accent, "#ffffff", 0.22),
  };
}

export function applyListTheme(color: ListColor, target: HTMLElement) {
  for (const [key, value] of Object.entries(listThemeVariables(color)))
    target.style.setProperty(key, value);
  target.dataset.listTheme = color;
}
