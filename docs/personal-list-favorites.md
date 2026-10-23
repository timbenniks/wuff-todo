# Personal list favorites — WUFF-86

Selected October 23, 2026. Favorites are personal shortcuts to frequently used lists.

## Behavior and contract

Use **List settings → Your sidebar → Add to favorites / Remove from favorites**. Owners and editors can favorite any accessible list. A Favorites section appears above the regular tree when there are active favorites; shortcuts follow the existing sidebar order and preserve the shared-list cue and list color. Opening a child favorite directly opens that list, even with its parent collapsed. The original tree location and collapse preference remain intact. Favorites do not include a parent's children automatically.

Favorites belong to the current account. List ownership, sharing, content, tasks/subtasks and shared list versions never change. Archived favorites remain saved but disappear from the active Favorites section until restored. Deletion and revoked access remove references from authorized reads; no inaccessible title or ID is returned.

Additive Drizzle migration `0016_icy_umar.sql` adds empty-default `favorite_list_ids` to `wuff_list_preferences`. The existing `getListOrder` / `reorderLists` contract exposes optional `favoriteListIds`; reads return accessible favorites and catalog summaries expose `favorite`. The array replaces the saved set; omitted fields preserve favorites for older clients and `[]` clears them. Duplicate and inaccessible IDs fail with `invalid_favorites`. All writes share the existing account lock, personal revision, scopes and operation receipt. Concurrent ordering/nesting/favorite changes cannot silently overwrite each other. Unknown-response retries send the identical payload and operation ID.

Web and Tauri use the same sidebar/settings components and existing HTTP/native adapters. MCP exposes the same fields through `get_list_order` and `reorder_lists`; MCP Apps show shortcut navigation and add/remove actions in the list catalog menu. Refresh client tool metadata after release to expose the new optional argument.

## Verification and release

Development migration applied through the existing direct connection, with exact pre-existing users/lists/tasks/members and all old preference fields preserved. Focused domain coverage verifies account isolation, editor access, invalid favorites, unchanged task/subtask snapshots and shared versions, retry safety, concurrency, legacy preservation, archive/restore and access revocation/deletion. Browser and release evidence is recorded in `verification.md` when completed. Installed native distribution remains a separate check.
