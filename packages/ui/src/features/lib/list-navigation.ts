// Optimistic lists are local previews, never destinations for history or links.
export function listSelectionHref(currentHref: string, listId: string) {
  if (listId.startsWith("pending-")) return null;
  const url = new URL(currentHref);
  if (listId) {
    url.searchParams.set("listId", listId);
    url.searchParams.delete("home");
  } else {
    url.searchParams.delete("listId");
    url.searchParams.set("home", "1");
  }
  return url.pathname + url.search;
}
