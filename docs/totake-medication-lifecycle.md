# Totake: pause, archive and delete registered items

## Feature brief

People need to remove stopped medications from their everyday list and pause
temporary treatments. This change belongs to Totake and also supports registered
equipment using the same schedule and record contract.

Agreed on November 5, 2026:

- Pause keeps the entry visible, labels it Paused and stops its reminders.
- Resume uses the saved schedule from now, without backfilling inactive doses.
- Archive hides the entry from the usual list and stops reminders. Archived items
  remain discoverable and can be restored with the same forward-only behavior.
- Delete requires confirmation, removes the entry from registered/archived lists
  and cannot be restored. Past taken/skipped records and stock history remain.
- No action records a dose as taken or skipped, changes stock, or changes another
  item in a grouped reminder. Old notification actions must fail after removal.

## Implementation and surfaces

Use root/web AGENTS.md, the repository wuff-contributor skill, module/surface
guides and existing Totake controls. Reuse updateTotake and the account lock,
version check and exact-payload receipts through PUT /api/v1/totake and
update_totake; authorized reads use GET /api/v1/totake and get_totake.

Lifecycle fields are server-owned JSON in the existing treatment body. A deleted
definition is retained only as a historical tombstone to support immutable record
snapshots and exact stock Undo; it cannot be edited, restored or reused. No SQL
migration, dependency, new scope, production setting or native adapter is planned.
MCP uses complete structured actions and the existing website handoff for item
management; the embedded daily overview retains its current focus. Refresh the
client tool catalogue to discover the extended action schema. Existing admission,
Totake consent and revocation rules apply to every call and replay.

## Acceptance and verification

- [x] Pause/Resume, Archive/Restore and confirmed Delete are reachable by keyboard
      and at 320px, 390px and desktop, with cancellation and retained failure recovery.
- [x] Pending/repeating/snoozed occurrences stop immediately for this item only.
- [x] Resume/Restore preserve schedule anchors and records without an inactive backlog.
- [x] Deleted entries stay deleted, including after stale edits and exact retries.
- [x] History, stock and Undo remain accurate and never revive inactive reminders.
- [x] Unit regressions cover transitions, grouped items, PRN, time zones and stock.
- [x] Real isolated HTTP/MCP parity covers permissions, conflicts and retries.

## Local verification — November 5

- New `tests/totake-lifecycle.test.ts`: 12 passing cases. With existing
  `tests/totake.test.ts`, all 33 targeted cases pass. Grouped snooze regression
  exposed refresh setting visible before the snooze elapsed; refresh now respects
  the snoozed instant. The grouped-item regression was verified failing with the
  old refresh behavior, then passing with the fix restored. Tests assert other-item
  timers and selection are preserved.
- `tests/totake.integration.test.ts`: both real isolated development cases pass.
  Added HTTP-pause/MCP-read and MCP-resume/archive/restore/delete/HTTP-readback;
  readonly/other-account denial, stale version, changed-payload operation reuse,
  exact retry, disabled scheduler, retained records/stock and Undo after deletion.
  Existing callback/provider-mocked delivery regression also passes. No real sends.
- `pnpm build`: optimized guide/MCP/web build passed. No deployment was performed.
- `pnpm typecheck`: all workspace and root TypeScript checks passed.
- Full `pnpm test`: 207 passed, three existing Windows failures remain: absolute
  dynamic ESM imports in empire-modules/mcp-tool-choices and slash expectations in
  unit-discovery. These are incomplete baseline checks, not waived or changed.
- Actual in-app browser at 320/390/1280px: Pause/Resume, Archive/Restore, persisted
  reload, long names, Delete explanation and Cancel, Escape/opener focus and
  forward/backward modal focus wrapping passed. No horizontal document overflow.
  Delete mutation/history/stock is proven by real HTTP/MCP, not a browser deletion.
  Unknown-reply/conflict recovery continues to use the existing retained request
  and Modal controls; new dialogs are portaled outside the disabled page fieldset
  so those controls remain reachable.

[320px](screenshots/totake-lifecycle-320.png) ·
[390px](screenshots/totake-lifecycle-390.png) ·
[desktop](screenshots/totake-lifecycle-1280.png).

Screenshots and local try-it entries contain fictional data in the synthetic Alex
development account. Physical devices, real notification receipt and screen-reader
use were not tested. No production data changes or release are included. The PR
remains a draft pending the full baseline and latest-head Codex review.
