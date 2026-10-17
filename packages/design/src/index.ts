import type { ListColor } from "@wuff/contracts";

export const listPalette: Record<
  ListColor,
  { label: string; accent: string; tint: string }
> = {
  blue: { label: "Blue", accent: "#315f9b", tint: "#eaf1fb" },
  lavender: { label: "Lavender", accent: "#7355a3", tint: "#f1ecf9" },
  sage: { label: "Sage", accent: "#34705a", tint: "#e9f4ee" },
  rose: { label: "Rose", accent: "#a23f66", tint: "#fbeef3" },
  peach: { label: "Peach", accent: "#a5502c", tint: "#fcf0e9" },
  sand: { label: "Sand", accent: "#826619", tint: "#f8f3e3" },
  slate: { label: "Slate", accent: "#526779", tint: "#edf1f5" },
};

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
