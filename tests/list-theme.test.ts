import assert from "node:assert/strict";
import test from "node:test";
import { listColors } from "@wuff/contracts";
import { listThemeVariables } from "../apps/web/src/lib/list-theme";

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [dark, light] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

test("every list theme keeps controls and text readable on all themed surfaces", () => {
  for (const color of listColors) {
    const tokens = listThemeVariables(color);
    assert.ok(
      contrast(tokens["--wuff-primary"], "#ffffff") >= 4.5,
      `${color} primary label`,
    );
    for (const surface of ["background", "surface", "sidebar", "accent"]) {
      const background = tokens[`--wuff-${surface}`];
      for (const text of ["foreground", "muted", "primary"])
        assert.ok(
          contrast(tokens[`--wuff-${text}`], background) >= 4.5,
          `${color} ${text} on ${surface}`,
        );
      assert.ok(
        contrast(tokens["--wuff-control"], background) >= 3,
        `${color} control on ${surface}`,
      );
    }
  }
});

test("switching a list theme changes every structural color role", () => {
  const blue = listThemeVariables("blue"),
    rose = listThemeVariables("rose");
  assert.deepEqual(Object.keys(blue), Object.keys(rose));
  for (const key of Object.keys(blue) as (keyof typeof blue)[])
    assert.notEqual(blue[key], rose[key], key);
});
