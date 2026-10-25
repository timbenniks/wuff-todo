
import type { Treatment } from "./treatments";
const counts = new Set([
  "tablet",
  "tablets",
  "pill",
  "pills",
  "capsule",
  "capsules",
  "sachet",
  "sachets",
  "patch",
  "patches",
  "sensor",
  "sensors",
  "catheter",
  "catheters",
  "set",
  "sets",
  "item",
  "items",
]);
export function stockEligible(t: Pick<Treatment, "kind" | "form" | "unit">) {
  return (
    !/liquid|drop|solution|syrup/i.test(t.form) &&
    counts.has(t.unit.trim().toLowerCase())
  );
}
