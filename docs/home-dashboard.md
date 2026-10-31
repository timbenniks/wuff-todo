# Personal Home — WUFF-87

Selected and released on the website/MCP October 23, 2026; WUFF-87 is done. Native frontend checks passed; updated distribution remains a separate gate.

Home answers “Wuff do I need to know?” with a personal greeting/Waffles, Today (overdue and due today), Coming up (tomorrow through seven days ahead), and Favorites. Home is permanently available above the list pack and favorites. The October 25 [Wuff Empire portal](wuff-empire.md) supersedes the original root redirect: `/` now owns the shared portal; web Todo calls its existing Home **Overview**, while native/MCP keep Home. Inside `/lists`, absence of an explicit list opens the overview, with an account preference to restore the last active accessible list on this device. `?home=1` explicitly opens the overview and bypasses last-list startup. Existing list/task links and browser Back/Forward retain their meaning. Portal previews follow the same section order/visibility settings; the startup preference affects Todo alone.

Customize Home uses explicit Save/Cancel, show/hide and up/down section ordering, Reset to default, and Home/last-list startup. Defaults show all three sections in that order and start on Home. All-hidden has a deliberate empty state and an available Customize action. Settings sync by account in independently revisioned `wuff_dashboard_preferences`; list order/nesting/favorites and shared list/task versions are unchanged. Each account's last-list ID is device-local navigation state, rechecked against active authorized lists. No task content or offline editing cache is stored.

`getDashboard` is one repeatable-read authorized projection, requires the existing lists:read scope, accepts an explicit local `today` calendar date and a 1–100 per-section preview limit (default 5), and returns exact matching totals. Preview dates cover all overdue tasks, today, and seven inclusive upcoming dates. Open independently dated subtasks appear with parent context even if the parent is complete. Completed tasks, undated tasks and archived/inaccessible lists are excluded. Every task includes list context, color, shared status and its existing detail URL; parent/task completion is never inferred or changed. The UI can show more up to 100 items per task section. Favorite lists retain existing sidebar order and authorization. No medication-specific model, scheduling, recurrence or notification delivery is added.

`updateDashboard` uses lists:manage, an independent expected preference version, account serialization and actor-scoped retry receipts. Arrays contain all three known section IDs exactly once; hidden IDs are a unique subset. Unknown-response retries send the exact same payload/operation ID. A known conflict preserves drafts and offers reloading saved settings; remote refresh never rewrites a customization draft. Web and native adapter share domain functions, React components and settings. MCP has get_dashboard, show_dashboard and update_dashboard; its embedded app supports the same cards and settings. Embedded users intentionally invoke Home; web/native startPage controls their workspace entry, not an explicit MCP tool call. Native task-preview links use the existing external task-page navigation.

Active Home refreshes on focus, visibility, reconnect and ten-second fallback; list-version changes delivered to the workspace by Neon also invalidate Home. Preferences from another device appear on the fallback/focus refresh. Failed reads clear the overview and offer Retry rather than implying an empty day. Dates are reevaluated across midnight and DST. Normal list task views, edits and permissions remain independent.

Migration `0017_tiresome_dreadnoughts.sql` is additive. Apply it only through the existing direct Vercel-managed connection, isolated development first, before production application release. Preserve existing rows and preference fields. Verification and release evidence belong in `verification.md`.

## UX Phase 3 — October 24, 2026

Implemented locally; production release pending. The heading is now “Your day”.
Separate completion buttons leave title links free to open the shared task drawer
on Home. The drawer retains Home context; ordinary modified links retain their
existing URLs. Add task requires a destination list, supports sections and retains
its title through destination changes and failed reads/saves. Undated creation
explains Today exclusion and offers the destination list with its saved view intact.

Acknowledged Home completions appear in a session-only Recently completed area
with Reopen. This explicit recovery path has no countdown and stores no personal
preference or offline task content. Completion/reopen/capture reuse the workspace
mutation pipeline and exact operation-ID retries. Fresh authorized reads precede
scalar writes; drawer form drafts keep their original conflict version. Catalog
changes prune inaccessible/archived destinations and task previews. Dashboard
refreshes cannot overwrite an in-flight task action or customization draft.

Customization, section order/visibility, startup preferences and account isolation
remain independent. This UI work adds no schema, API or MCP tool contract. See
[Phase 3 decisions](ux-improvement-spec.md#phase-3--actionable-home-and-completion-flow)
and [verification](verification.md#ux-improvement-phase-3--october-24-2026).

## List-first Todo overview — October 31, 2026

Implemented on `codex/todo-ux-maturity`; release is separate. Todo Overview starts
with Your lists, New list and title search over the authorized active catalog.
Undated/nonfavorite lists appear too; matching children retain parent context.
Today/Coming up/Favorites retain their synced visibility/order settings below this
structural catalog. All-hidden dated sections cannot hide the catalog. Search and
overview expansion are transient UI state, with no schema/settings migration.
The Empire portal widget remains unchanged. Existing Home capture/completion and
last-list startup behavior remain. Embedded Home receives an authorized catalog
with its dashboard response; tool-only discovery still uses list_lists.
See [implementation and evidence](todo-ux-maturity-plan.md).

## Focused productivity update — October 31, 2026

The [focused redesign](todo-productivity-redesign.md) supersedes the list-first
ordering above: Today/Coming up precede a compact complete list browser. Favorites
remain flat sidebar shortcuts rather than a duplicate Overview card. The existing
three-field settings schema is retained without migration; Todo UI shows/reorders
the two day panels while preserving the old favorite field. The independent Empire
portal summary keeps its current settings behavior. Search expands only on demand
for six or fewer lists; catalog errors and empty states remain visible.
