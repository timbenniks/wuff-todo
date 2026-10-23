# Personal list nesting — WUFF-85

Selected October 23, 2026. Implementation is local until the production migration and application release are completed.

## Behavior

Each account can arrange accessible lists into one level of nesting. A parent remains a normal list with its own tasks. A child remains an independent list with its own tasks, subtasks, notes, images, sections, sharing, theme and owner. Opening a parent shows only its own tasks. Nesting never adds a level to the task/subtask model.

Use **Move list** in the sidebar to choose a list and a parent, or **Top level** to remove its parent. Existing lists can be moved without copying content. Create a list normally, then place it under its parent. Parents expand/collapse through separate labeled buttons; opening a child directly reveals it in the sidebar. Drag handles and the existing position picker reorder siblings. Moving a parent carries its visual child group; reparenting uses the explicit picker. A list with children cannot become a child until its children are moved. There are no grandchildren or cycles.

Organization and collapse state belong only to the signed-in account, including for editors of shared lists. They never change another member's sidebar, list membership, list versions, or task order. No sharing permission is inherited between parent and child.

Accessible children whose parent is archived, deleted, or no longer accessible appear at top level in the applicable active/archive view. An archive mismatch temporarily promotes the child; restoring matching archive state reveals the saved relation again. Deleting a parent deletes only that list's own content, following the existing confirmation; child lists and their tasks survive. A missing/inaccessible parent's ID is filtered from returned preferences. A later sidebar save prunes stale references.

## Contract and storage

Additive Drizzle migration `0015_swift_randall_flagg.sql` adds `nesting` and `collapsed_list_ids` JSON arrays to `wuff_list_preferences`, both empty by default. Original `list_ids` and `version` values remain intact. No list/task or auth-managed schema changes.

`GET /api/v1/list-order`, native `getListOrder`, and MCP `get_list_order` return:

```json
{
  "version": 7,
  "listIds": ["parent-uuid", "child-uuid"],
  "nesting": [{ "listId": "child-uuid", "parentListId": "parent-uuid" }],
  "collapsedListIds": ["parent-uuid"]
}
```

The existing PUT/native `reorderLists`/MCP `reorder_lists` accepts optional replacement `nesting` and `collapsedListIds` arrays with all accessible list IDs, the personal revision, and an operation UUID. Omission preserves the corresponding preference for older clients; an empty array clears it. All fields share the existing account-row lock and revision, so concurrent reorder/nesting/collapse writes cannot overwrite each other silently. Identical retries reuse the exact operation ID and payload; mismatched reuse fails. Read-only grants cannot write.

List catalog summaries add viewer-specific `parentListId` and `sidebarCollapsed`. `TodoList` snapshots remain independent of sidebar hierarchy. The existing Realtime preference version already invalidates catalog reads; polling/focus recovery remains active. Web/Tauri share the sidebar implementation. The MCP App catalog groups and indents children, provides parent selectors, collapse controls and sibling ordering, and preserves exact-payload retries after an uncertain response. MCP clients must refresh tool metadata after the updated application is released.

## Release and verification

The migration was applied only to the existing isolated development branch using its direct connection. Before/after fingerprints confirmed all existing list/task/membership rows and original sidebar preference values were preserved. Production migration, deployment and installed-device verification are separate release steps.

All 87 unit tests, five focused integration cases, TypeScript, web/MCP and native frontend builds passed. Responsive web flows and the real local MCP Apps SDK host passed; see [verification commands, screenshots and limits](verification.md#personal-list-nesting--october-23-2026).
