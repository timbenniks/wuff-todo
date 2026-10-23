// Reorder a visible subset while preserving every other item's position (for
// example other sections or archived sidebar lists). Refuse stale membership.
export function mergeVisibleOrder(
  all: string[],
  before: string[],
  after: string[],
) {
  const subset = new Set(before);
  if (
    subset.size !== before.length ||
    after.length !== before.length ||
    new Set(after).size !== after.length ||
    after.some((id) => !subset.has(id)) ||
    all.filter((id) => subset.has(id)).join() !== before.join()
  )
    return null;
  let i = 0;
  return all.map((id) => (subset.has(id) ? after[i++] : id));
}
