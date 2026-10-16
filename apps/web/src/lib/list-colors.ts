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
