import type { NoteCard, NoteReference, BoardBody } from "./index";
export const noteRoleCanEdit = (role: string) =>
  role === "owner" || role === "editor";
export const noteRoleCanManage = (role: string) => role === "owner";
export function noteCapabilities(
  role: string,
  trashed: boolean,
  scopes: readonly string[],
) {
  return {
    canEdit:
      !trashed &&
      noteRoleCanEdit(role) &&
      scopes.includes("notes:read") &&
      scopes.includes("notes:write"),
    canManage:
      noteRoleCanManage(role) &&
      scopes.includes("notes:read") &&
      scopes.includes("notes:manage"),
    canPersonalize:
      !trashed &&
      scopes.includes("notes:read") &&
      scopes.includes("notes:write") &&
      ["owner", "editor", "viewer"].includes(role),
    canExport:
      !trashed &&
      scopes.includes("notes:read") &&
      scopes.includes("lists:read") &&
      scopes.includes("tasks:write") &&
      ["owner", "editor", "viewer"].includes(role),
  };
}
export function projectNoteCards(
  cards: readonly { id: string; position: number; body: BoardBody }[],
  targets: readonly NoteReference[],
  readyAssets: ReadonlySet<string>,
  imagePath: (id: string) => string,
): NoteCard[] {
  return cards.map((card) => {
    if (card.body.kind === "note") {
      const target = targets.find(
        (t) => t.id === (card.body as { targetId: string }).targetId,
      );
      return target
        ? { ...card, target }
        : {
            id: card.id,
            position: card.position,
            body: { kind: "note", unavailable: true },
          };
    }
    return {
      ...card,
      ...(card.body.kind === "image" && readyAssets.has(card.body.assetId)
        ? { imagePath: imagePath(card.body.assetId) }
        : {}),
    };
  });
}
