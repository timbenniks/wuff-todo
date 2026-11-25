import type { BoardBody, NoteFields } from "@wuff/contracts";

export function duplicateNoteFields(source: NoteFields): NoteFields {
  const prefix = "Copy of ";
  return {
    title:
      prefix +
      source.title
        .slice(0, 300 - prefix.length)
        .replace(/[\uD800-\uDBFF]$/u, ""),
    content: source.content,
    tags: source.tags,
    mode: source.mode,
    theme: source.theme,
  };
}

export function duplicateNoteCards(
  cards: readonly { body: BoardBody }[],
  assetIds: ReadonlyMap<string, string>,
  visibleTargets: ReadonlySet<string>,
) {
  const bodies = cards.flatMap(({ body }): BoardBody[] => {
    if (body.kind === "image") {
      const assetId = assetIds.get(body.assetId);
      return assetId ? [{ ...body, assetId }] : [];
    }
    if (body.kind === "note" && !visibleTargets.has(body.targetId)) return [];
    return [body];
  });
  return bodies.map((body, position) => ({ body, position }));
}
