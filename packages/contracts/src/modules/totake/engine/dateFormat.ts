/** Display only; persisted dates remain ISO or day offsets. */
export function displayISO(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("-")
    : "";
}
export function parseDisplayDate(value: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number(year) > 0 &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}
