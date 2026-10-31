# Todo productivity redesign

October 31, 2026. Tim's focused redesign supersedes the previous list-first
Overview and expandable favorite shortcuts. Continue draft PR #45; no merge or
production operation is authorized.

## Component inventory and implementation sequence

| Stage | Reuse | Necessary changes |
| --- | --- | --- |
| Foundations | DM Sans, listPalette, Button/Input/NativeSelect, existing tokens | Quiet neutral surfaces, 4px rhythm, shared typography/control tokens; system light/dark; retain seven list accents. |
| Sidebar | SidebarLists, authorized catalog, sortable controls, personal actions | 260px default, flat contextual favorite shortcuts, consistent tree rails, contextual drag/actions, Reset width in sidebar menu, footer retained. |
| Header/toolbar | ListSettings, ListPersonalActions, ListViewControls/ViewPopover | Title/count/description anchor, Add task at header; Search/Filter/View with unified configuration; all advanced options retained. |
| Rows/sections | TaskRow, InlineName, TaskMetadata, SortableList, CompletedTasks | 44–48px base rows, no empty metadata columns, contextual actions, lightweight headings/counts, terse completed group. |
| Capture | Existing versioned ListChange pipeline and TaskCapture | Collapsed per-section inline composer, Enter creates/repeats, Escape cancels safely, exact retry and drafts retained; header opens list-scoped inline capture. |
| Drawer | TaskDetailDrawer/Content, WorkMetadata, TaskNotes, TaskDueDate, TaskReminder, Subtasks | 520px desktop drawer, completion beside title, compact property controls, borderless notes/checklist, focused toolbar, existing draft/dirty-exit/focus protections retained. |
| Overview | HomeDashboard/useHomeTasks, existing catalog/dashboard | Heading/action, Today/Upcoming, compact list browser; one New list action, less chrome; saved panel order/visibility retained. |
| Consistency | Existing web/MCP domain/API and tool adapters | Populated fixtures (20+ tasks), light/dark, desktop/phone screenshots per major stage, keyboard/focus, retry/conflict and actual MCP parity. |

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
