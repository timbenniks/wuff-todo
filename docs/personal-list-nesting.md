# Personal list nesting — WUFF-85

Selected and released on the website/MCP October 23, 2026. Installed native distribution remains a separate platform gate.

## Behavior

Each account can arrange accessible lists into one level of nesting. A parent remains a normal list with its own tasks. A child remains an independent list with its own tasks, subtasks, notes, images, sections, sharing, theme and owner. Opening a parent shows only its own tasks. Nesting never adds a level to the task/subtask model.

Open the selected list’s **Settings → Your sidebar**, choose a **Parent list**, then select **Move list**. Choose **Top level** to remove its parent. Existing lists can be moved without copying content. Create a list normally, then place it under its parent. Parents expand/collapse through separate labeled buttons; opening a child directly reveals it in the sidebar. Drag handles and the existing position picker reorder siblings. Moving a parent carries its visual child group; reparenting uses the explicit picker. A list with children cannot become a child until its children are moved. There are no grandchildren or cycles.

The sidebar’s **Archive** browser sits at the bottom beside account **Settings**. The owner-only **Archive list / Restore list** action stays inside the selected list’s settings. Personal location controls are available to editors too, without exposing owner-only settings. Saving a personal location leaves any unsaved list-details draft intact.

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

The migration passed on the existing isolated development branch, then production through its Vercel-managed direct connection. Before/after fingerprints preserved existing user/list/task/member rows and original sidebar preference values. Source `ba160b1` is deployed through Vercel CLI as `dpl_9ouUyX4AmeHu7XLdhRkg1ybV696E`, Ready on the canonical production URL in `fra1`. Authenticated Chrome saved nesting, retained it across reload and collapsed/expanded the group; the live Codex MCP connection read the same hierarchy. Independent rereads preserved task/subtask snapshots. Disposable lists were removed and pre-existing production data fingerprints matched before WUFF-85 was marked done.

GitHub Actions could not start because account billing/spending limits blocked runners (runs `40020000501` and `40019999828`); local checks and the Vercel build passed. Updated downloadable native artifacts and installed-device checks are not certified by this web/MCP release.

All 87 unit tests, five focused integration cases, TypeScript, web/MCP and native frontend builds passed. Responsive web flows and the real local MCP Apps SDK host passed; see [verification commands, screenshots and limits](verification.md#personal-list-nesting--october-23-2026).
