import type { ListSummary } from "@wuff/contracts";

// Enrich read and mutation snapshots through the same authorized catalog reader.
// Catalog refresh is optional after the authorized operation has succeeded.
// Never mask a committed write or retain stale navigation if that refresh fails.
export async function todoNavigationResponse(
  data: Record<string, unknown>,
  canRead: boolean,
  readCatalog: () => Promise<ListSummary[]>,
) {
  if (!canRead || (!data.list && !data.dashboard)) return data;
  try {
    return { ...data, lists: await readCatalog(), catalogUnavailable: false };
  } catch {
    return { ...data, lists: [], catalogUnavailable: true };
  }
}
