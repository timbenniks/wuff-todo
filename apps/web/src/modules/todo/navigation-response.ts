import type { ListSummary } from "@wuff/contracts";

// Enrich read and mutation snapshots through the same authorized catalog reader.
// A failed read must propagate so an uncertain mutation can use its exact receipt.
export async function todoNavigationResponse(
  data: Record<string, unknown>,
  canRead: boolean,
  readCatalog: () => Promise<ListSummary[]>,
) {
  if (!canRead || (!data.list && !data.dashboard)) return data;
  return { ...data, lists: await readCatalog() };
}
