# Subtasks

Updated: October 16, 2026

## Scope and interaction

One level of subtasks, before due dates and native mobile. Add a little step directly from the parent's Subtasks action, edit names inline, complete individually, drag siblings to reorder, and see completed/total progress. Existing Wuff typography, list colors, compact task controls and corgi voice carry through. An indented left rule groups the steps visually; no separate task-detail page or new navigation is needed.

Completion is independent in both directions. Completing/reopening a parent leaves all child states intact; completing every child does not auto-complete the parent. Children stay under their parent, including completed steps. A completed parent lives in the existing Completed group with its children. Its progress stays visible and it can still accept new steps. This keeps manual completion explicit and avoids cascading surprises across clients.

Children follow the parent's section and move with it. They cannot change parent, become parents themselves, or move independently between sections in this milestone. Deleting a child removes that child; deleting a parent removes all its children. The web explains this consequence inline before deleting a parent with children. Archived lists allow reading, with task/subtask mutations denied on the server.

## Storage and contracts

The existing task table gains nullable `parent_task_id`; existing rows remain top-level. A composite self-referencing foreign key on `(parent_task_id, list_id)` prevents cross-list parentage and cascades child deletion. An index supports sibling reads; checks reject self-parentage and child sections. The domain validates that parents are top-level tasks while holding the same list lock used by task writes and access changes. No reparenting operation exists, so domain writes cannot form cycles or grandchildren. Auth-managed tables are unchanged.

Snapshots remain a flat `tasks` array, with `parentTaskId: string | null` on each item. This gives API/MCP clients explicit relationships without changing task IDs, content, image permissions or error codes. Counts of top-level tasks exclude children; subtask progress counts direct children.

Existing create/update/delete/reorder HTTP routes and MCP tools are reused. `create_task` / `POST /api/v1/tasks` accepts optional `parentTaskId`. `update_task` edits a child exactly like a task, with independent completion and full notes/image support. The section of a child is inherited from its parent; its stored `sectionId` remains null.

For reorder, omitted/null `parentTaskId` means all active top-level tasks exactly once. A parent UUID means all children of that parent exactly once, including completed ones. Child completion does not change position. Root reopening keeps the existing append-to-active-order behavior. Ordering never changes parentage or another sibling group's positions.

All writes reuse `tasks:write`, admitted owner/editor access, active-list checks, current list versions and actor-scoped operation UUIDs. List version increments drive the existing live subscriptions, so web and MCP changes invalidate open views together. Identical retries reread current authorization; stale/conflicting writes cannot overwrite another change. Refresh MCP tool catalogs to discover the new optional inputs and ordering semantics; no OAuth scope change is required.

## Migration and verification

Migration `0005_violet_zuras.sql` is additive. Its generated statements were ordered so the referenced unique index exists before the composite foreign key is added. Apply via the existing direct-connection Drizzle migration runner on isolated development first, then production before deployment. Existing data must remain unchanged. Release evidence will be recorded here after checks complete.

Sources: [Drizzle constraints and self-references](https://orm.drizzle.team/docs/indexes-constraints), [Neon migration branches](https://neon.com/blog/practical-guide-to-database-branching).

## Verification — October 16, 2026

- `pnpm check` passed: workspace/root TypeScript, all 22 unit tests, and optimized Next.js/MCP App builds. Static scanning of 20 browser scripts found no environment secrets or server-side domain SQL.
- All 18 distinct development integration cases passed across the full run and targeted reruns. The combined run passed 17/18; the existing HTTP image-adapter case hit managed Auth HTTP 429 while a browser was also polling. With browser polling stopped, that case passed independently. The two new subtask cases passed again after adding the post-cascade image-read assertion. Keep browser checks separate from shared synthetic-identity/auth stress tests.
- New domain coverage: same-list root parents only; foreign/missing parents and grandchildren denied; read-only scopes; owner/editor operations; changed/identical retries; independent completion both ways; completed-child position preservation; exact sibling order including completed steps; root order excluding children; inherited sections and section removal; archived writes; stale concurrent mutation rejection; membership revocation and old-receipt replay; cascading parent deletion; attachment cleanup records retained and orphaned images denied.
- The authenticated HTTP/OAuth/MCP integration case now covers MCP-to-web and web-to-MCP subtasks, canonical child notes, sibling ordering, root ordering excluding children, invalid grandchildren, and live list-version delivery. Existing OAuth, permission, list, sharing, notes and image cases remain exercised.
- On the optimized build, a synthetic browser account added and renamed steps inline, completed independently, reordered with pointer and keyboard, saved subtask notes through Tiptap, and showed the inline parent-deletion warning. A typed new step survived parent completion into Completed. MCP App addition/reopening and keyboard reordering appeared in the open website while another typed draft stayed intact. A subsequent domain read confirmed saved child notes, order and completion state.
- Phone layout measured `innerWidth = scrollWidth = 390`. Screenshots: [web](screenshots/subtasks-web.jpg), [phone-width full page](screenshots/subtasks-mobile.jpg), [MCP App SDK host](screenshots/subtasks-mcp.jpg). This is browser/official SDK-host evidence, not physical-device, named-host or screen-reader certification. MCP App pointer dragging is implemented; its keyboard alternative was exercised. Web pointer and keyboard dragging were both exercised.
- The additive migration passed first on isolated development, then on production through a direct connection. Before/after hashes of existing production task records (excluding the new nullable column) matched. No existing task data or auth-managed tables were changed.
- Source commit `6b491e1c59d511653651c89cd8519c8aa10d4c0c` is pushed and [GitHub checks](https://github.com/timbenniks/wuff-todo/actions/runs/38915055286) passed. CLI deployment `dpl_Dzg24j5UQUwVTtagRG8R4GVfM4HG` is READY, reports runtime region `fra1`, and is aliased to [Wuff Todo](https://wuff-todo.vercel.app).
- Production browser smoke used the existing authenticated session and a disposable synthetic list: created a parent and two children through the web API, completed one child, and observed 1/2 progress with the parent still open. A separate domain read verified the exact persisted relationship/state. The temporary list was then removed and verified inaccessible. [Production screenshot](screenshots/subtasks-production.jpg) shows only the synthetic main content, excluding the private sidebar. Existing real lists/tasks were not changed.
- Temporary development lists were removed and browser/integration OAuth grants for the synthetic identities verified revoked. The original baseline fixture is preserved and the local dev server is restored. Production authenticated MCP calls and named Codex/ChatGPT UI were not reverified for this milestone; the authenticated MCP protocol/SDK-host evidence above uses development. Refresh MCP tool catalogs to pick up `parentTaskId` and updated sibling-ordering instructions; no new scopes or tools are required.
