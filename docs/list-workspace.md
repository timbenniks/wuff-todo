# List workspace — October 24, 2026

The user selected one compact view toolbar for both Basic and Work lists. Work lists default to richer columns on wide screens; Basic lists remain simple. There is no global Advanced mode.

## Interaction

Search, saved preset, Filter, Sort, Group, Display and Presets live in a compact toolbar. Focused native popovers replace the full-width Your view form. Web filtering previews locally; Save view persists explicitly and Revert restores the latest saved version. Filter chips expose active restrictions. Dirty changes prevent silently switching presets. Sort-per-section remains under Sort. Display contains density and, for Work lists, Columns/Simple rows and status/priority/assignee/due visibility.

Starter choices are Default, Open tasks and By due date, plus My open tasks and Blocked on Work lists. The date starter sorts/groups existing due dates rather than inventing a new calendar window. People may save, update, rename and explicitly delete up to 20 named presets per list. Names are trimmed, bounded and case-insensitively unique. A named preset snapshots filters/search, grouping/sorting, density, collapsed groups and display choices; it belongs only to the current account/list. Reset preserves the preset collection.

Wide Work rows align task title, status, priority, assignee and due date. Metadata cells have small explicit Save/Cancel editors. They use the shared list version and existing task permissions; a stale save retains its draft and requires explicit reload. Rows reveal notes/subtask quick actions on hover or keyboard focus, retain the overflow menu and delete confirmation, and retain normal completion and task-drawer navigation. Column drafts survive filtering/display changes in the mounted list, just like note/date drafts. Basic lists do not show unused Work fields. Columns collapse below a 1000px content width; quick actions require 800px. Phone toolbars wrap, use viewport-bounded popovers and retain existing row metadata/menu controls. Dragging remains unavailable under computed sorting.

## Persistence and compatibility

The existing app-owned personal-view JSON stores `presets`, `activePresetId`, `columns` and `rowStyle`. No SQL migration or auth table change is required. Reads normalize existing records with defaults. The existing version, admission/scope checks, account/list key, list lock and operation receipts protect all preference changes; shared task/list versions and positions stay independent.

Legacy writes still replace core view settings but preserve those four extension fields when omitted. Explicit arrays/null replace or clear them. This prevents old MCP/native clients from silently deleting saved presets. Preset IDs/names, selected references, collection bounds and nested settings are validated before persistence. Older server builds used a strict view parser: after new extension fields have been saved, fix forward rather than rolling back to a server that cannot read them; any rollback translation must preserve/export personal presets first.

HTTP, native and MCP use the same domain function and public contracts. The MCP App exposes the same starter/named preset management and display controls through the compact toolbar; its constrained host keeps responsive stacked task metadata.

## Verification

See `verification.md` for completed evidence. Use isolated development with `tests/list-view.integration.test.ts`, then the optimized website and `scripts/verify-list-workspace-ui.ts` separately. Synthetic fixtures are deleted afterward. Build output, local SDK-host checks, production browser checks and installed native behavior are distinct evidence.
