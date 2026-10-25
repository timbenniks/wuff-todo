// Counted stock uses decimal strings at the boundary and scaled integers internally.
// BigInt never enters JSON or the database contract.
const scale = 1_000_000_000_000n;
export function count(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,12}))?$/.exec(value);
  if (!match) throw Error("Enter a count with at most 12 decimal places.");
  const n =
    (BigInt(match[2]) * scale + BigInt((match[3] ?? "").padEnd(12, "0"))) *
    (match[1] ? -1n : 1n);
  if (n > 1_000_000_000n * scale || n < -1_000_000_000n * scale)
    throw Error("Count exceeds the supported range.");
  return n;
}
export function countText(value: bigint): string {
  const sign = value < 0 ? "-" : "";
  const n = value < 0 ? -value : value;
  const whole = n / scale;
  const fraction = (n % scale).toString().padStart(12, "0").replace(/0+$/, "");
  return sign + whole + (fraction ? "." + fraction : "");
}
