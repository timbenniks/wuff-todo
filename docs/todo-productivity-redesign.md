# Todo productivity redesign

October 31, 2026. Tim's focused redesign supersedes the previous list-first
Overview and expandable favorite shortcuts. Continue draft PR #45; no merge or
production operation is authorized.

## Latest feedback: appearance and action menus

Tim requested an explicit appearance toggle and restoration of the original list
themes after trying the local redesign. This supersedes the neutral/system-only
direction below: Light is the default and uses the original listThemeVariables
unchanged; Dark derives tinted surfaces from the same selected list; System is an
explicit optional choice. The Appearance control is in the sidebar footer and
full task page, with an equivalent control in embedded Todo. Only the appearance
choice is stored on this device; blocked storage still supports changes in the
current document. No synced account data, new HTTP/MCP mutation, scopes or consent.

The photographed List actions menu is corrected: named List settings and People
& sharing rows replace unlabelled icon buttons, Move to… progressively discloses
the parent selector/action, and redundant status/explanation is removed from the
normal menu. Existing move/favorite permissions and exact retries are unchanged.

Codex review of 123372d also found a dead Favorites toggle in embedded Customize
Home. Web and MCP now share the same day-panel projection/reorder/reset helper: only
Today/Coming up controls appear, and saved Favorites visibility and its position
are preserved. Existing tool contracts and Empire portal preferences remain.

New unit cases cover explicit Light overriding a dark OS, Dark overriding a light
OS, System following either, original light palette retention, tinted dark
palettes, local persistence/events/storage failure and day-panel bounds/preference
preservation. All 204 unit tests and TypeScript pass. Optimized guide/MCP/web build
passed. Updated actual browser checks pass Light overriding a dark OS, explicit
Dark/System switching, Dark after reload, visible menu action labels and progressive
parent controls. Updated navigation/actual MCP SDK checks also pass, including the
visible two-panel customization controls, reorder bounds and Cancel.

## Component inventory and implementation sequence

| Stage          | Reuse                                                                                  | Necessary changes                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations    | DM Sans, listPalette, Button/Input/NativeSelect, existing tokens                       | Quiet neutral surfaces, 4px rhythm, shared typography/control tokens; system light/dark; retain seven list accents.                                                          |
| Sidebar        | SidebarLists, authorized catalog, sortable controls, personal actions                  | 260px default, flat contextual favorite shortcuts, consistent tree rails, contextual drag/actions, Reset width in sidebar menu, footer retained.                             |
| Header/toolbar | ListSettings, ListPersonalActions, ListViewControls/ViewPopover                        | Title/count/description anchor, Add task at header; Search/Filter/View with unified configuration; all advanced options retained.                                            |
| Rows/sections  | TaskRow, InlineName, TaskMetadata, SortableList, CompletedTasks                        | 44–48px base rows, no empty metadata columns, contextual actions, lightweight headings/counts, terse completed group.                                                        |
| Capture        | Existing versioned ListChange pipeline and TaskCapture                                 | Collapsed per-section inline composer, Enter creates/repeats, Escape cancels safely, exact retry and drafts retained; header opens list-scoped inline capture.               |
| Drawer         | TaskDetailDrawer/Content, WorkMetadata, TaskNotes, TaskDueDate, TaskReminder, Subtasks | 520px desktop drawer, completion beside title, compact property controls, borderless notes/checklist, focused toolbar, existing draft/dirty-exit/focus protections retained. |
| Overview       | HomeDashboard/useHomeTasks, existing catalog/dashboard                                 | Heading/action, Today/Upcoming, compact list browser; one New list action, less chrome; saved panel order/visibility retained.                                               |
| Consistency    | Existing web/MCP domain/API and tool adapters                                          | Populated fixtures (20+ tasks), light/dark, desktop/phone screenshots per major stage, keyboard/focus, retry/conflict and actual MCP parity.                                 |

## Scope and invariants

Owning module: Todo. Root/apps-web AGENTS, contributor workflow, module/surface,
design and accessibility guides apply. Existing public routes, tools, schema,
authorization, private/shared boundaries, scopes/consent, operation receipts,
versions and task relationships remain authoritative. No new framework/dependency,
provider, migration, paid execution or production configuration. Numeric sidebar
width stays account/device-local. Theme follows system appearance, with no new
synced account setting. Empire/other-product behavior remains independent.

HTTP/MCP equivalents remain the existing list/order/view/task/section/reminder
services and adapters. Personal move/favorite/view edits use current domain
operations. Embedded favorites become flat shortcuts too; shared colors/dark
foundations apply to Todo's embedded view. Tool-only functionality remains intact.
No scope or consent expansion. Unit plans cover theme contrast, populated-column
projection, composer state/payload/retry boundaries and regression cases. Actual
adapter tests plus browser/SDK flows verify persisted operations separately.

## Acceptance and evidence

Implement in the sequence above. Capture the actual optimized local app after
major stages. Use isolated synthetic accounts and at least 20 tasks across three
sections, completed items, subtasks, dates, notes, priorities and long titles.
Verify completion/title separation, section-scoped repeated creation, cancellation,
uncertain reply/retry, all advanced view controls, drawer dirty-exit/focus/scroll,
missing metadata, empty/populated states, narrower widths and light/dark contrast.
Keep actual commands/results, changed tests, screenshots and review/fix evidence
current in the draft PR. Browser evidence is distinct from physical-device and
screen-reader certification. Human usability review and release remain separate.

New unsaved views now default to simple rows across contracts/API/MCP/web. Explicit
saved column layouts remain intact and available under View → Display; empty
optional columns are omitted from rendering without rewriting saved column choices.
This is an additive presentation-default change, with no migration or data rewrite.

## Implemented interactions and surface mapping

| Interaction                                                           | Shared service and existing adapters                                               | Boundary preserved                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Task/section/subtask inline capture, completion, title/notes/metadata | createTask/updateTask; HTTP `/api/v1/tasks`; MCP create_task/update_task           | Actor membership, current list version, exact operation receipts; section/parent validation |
| View filters/sorts/grouping/display/presets                           | updateListView/queryListView; HTTP list view; MCP update_list_view/query_list_view | Personal view revision, conflict drafts, saved presets and explicit columns                 |
| Favorites, nesting, collapse/order                                    | getListOrder/reorderLists; HTTP list-order; MCP get_list_order/reorder_lists       | Personal organization; no task/list ownership changes                                       |
| Notes, due dates, reminders, sharing, integrations                    | Existing detail components/services/adapters                                       | Current authorized behavior and explicit save/cancel retained                               |

No schema, auth, scope, consent, connection or provider changes. A new unsaved
view’s public rowStyle default changes to list uniformly; explicit saved columns
are retained. MCP App uses neutral system appearance, flat Favorites and
attention-first Overview; its existing tool-backed detail/view controls remain.

## Local verification checkpoint

- `pnpm typecheck` passed after the dialog hydration/focus corrections.
- `pnpm test`: 201 passed, no skips. New `tests/todo-productivity.test.ts` covers
  all seven light/dark palette contrasts, empty/populated optional columns without
  changing saved preferences, task payload/version/section/parent inheritance,
  invalid/archived/removed destinations and capture event list isolation. Existing
  view and sidebar tests cover simple-row defaults, explicit column retention and
  260px width reset/clamping.
- `pnpm preview:local`: guide, MCP and optimized web build/start passed.
- `scripts/verify-todo-productivity.ts full`: actual isolated-backend Chrome flow
  passed with 27 initial tasks, three sections, subtasks/completed/dates/notes/long
  titles. Repeated Enter/Escape/focus, scoped creation, lost committed response
  identical retry/no duplicate, filtering/grouping/saved column view/reset,
  completion/reopen without opening details, dirty notes guard/save, property
  focus, subtask/parent drawer navigation and list focus/scroll restoration passed.
  Light/dark captures and Overview widths 320/390/1024/1366 had no page errors.
- An earlier run caught a settings portal hydration mismatch. Mounting the portal
  after hydration fixes it; current browser flow opens/closes the modal and checks
  trigger focus. One intervening run encountered existing managed-auth 503 session
  verification failure; the draft retained its content and the next full run passed.

Navigation/actual MCP SDK also passed: width keyboard/pointer/reset/reload/clamp,
canonical/flat favorites, child/sibling/Back/direct moves, 320–1440px overflow,
catalog failure/retry and detail-only failure isolation. Real embedded SDK task
mutations retained parent/child context. All six serial integration cases passed
(view/favorites/nesting/navigation adapters), including scopes/origins/revocation,
concurrency and exact retries. No production changes or release.

## Review correction

Codex review of `b7179d9` found a post-write catalog refresh could mask a committed
MCP mutation as an error (discussion_r4431651561). Catalog enrichment now preserves
the authorized operation result, clears stale navigation, marks its availability
and offers a read-only refresh. Original action failures still propagate normally.
The regression test proves the committed result survives, stale parents are absent,
backend exception details are omitted and a later catalog refresh recovers. The
SDK browser test injects this precise degraded response after one real task write
and checks capture resets/remains enabled, no duplicate exists, stale context is
hidden and the read-only refresh restores it. This is supplemental navigation
presentation; existing mutation services/HTTP contracts/scopes are unchanged.

The catalog regression was executed against the old helper and failed (exit 1);
with the fix, all eight navigation unit cases pass. The complete unit suite has
201 passes, no skips. The synthetic browser runner spaces API requests to respect
the managed development auth rate limit; no production/auth policy was changed.

## Final local boundaries

The updated navigation/actual MCP SDK suite passed with no page errors, including
the injected post-commit catalog failure and recovery. A separate current-source
27-task drawer check passed empty notes/subtasks at 390px, no drawer overflow,
Escape and originating-task focus; its light/dark workspace captures also passed.
Later full-suite repetitions were blocked by managed-auth 429 responses even with
runner pacing. The earlier complete dense flow passed; these blocked reruns are
not treated as current-head full-suite passes. Keep the PR draft for this limit
and Tim’s usability review. No auth cache/rate policy or service protections were
changed to obtain test success.

Final adapter rerun after the catalog recovery fix: four domain cases passed; the
HTTP nesting write returned managed-auth 429 and navigation consent SSR returned
500 with `auth_unavailable`/429 in the local server log. Those two cases remain
blocked for current-source full-adapter verification. The earlier all-six pass and
updated real SDK recovery pass remain separate evidence. Keep PR #45 draft.

Appearance/menu follow-up at 44ba668: the separate themed drawer check passed
light/dark surface changes, 390px empty notes/subtasks, Escape and origin focus.
The serial view/favorites/nesting/navigation integration rerun passed all six
cases with no skips (72.7 seconds), including the two previously throttled adapter
cases. The earlier blocked combined dense-flow runs remain explicitly historical;
updated menu/appearance, drawer and navigation/actual SDK checks all pass.

## Cross-product appearance reset

Review of 44ba668 found that MCP’s shared render transition reset palette tokens
but retained Todo’s `color-scheme: dark`. The shared design reset now restores
light native controls, removes Todo’s appearance marker/action override and applies
the existing blue shell before the next module renders. Todo reapplies its explicit
choice when active; later OS changes are ignored while another module is active.
A new unit case verifies shell tokens, native scheme, marker/action cleanup and
unrelated metadata preservation. All 205 units and TypeScript pass. The SDK fixture
can deliver real read-only tool results to verify Dark/System → Empire transitions.
