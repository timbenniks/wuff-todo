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

- [ ] Pause/Resume, Archive/Restore and confirmed Delete are reachable by keyboard
  and at 320px, 390px and desktop, with cancellation and retained failure recovery.
- [ ] Pending/repeating/snoozed occurrences stop immediately for this item only.
- [ ] Resume/Restore preserve schedule anchors and records without an inactive backlog.
- [ ] Deleted entries stay deleted, including after stale edits and exact retries.
- [ ] History, stock and Undo remain accurate and never revive inactive reminders.
- [ ] Unit regressions cover transitions, grouped items, PRN, time zones and stock.
- [ ] Real isolated HTTP/MCP parity covers permissions, conflicts and retries.

Verification results and the latest review will be recorded before handoff.
Use synthetic accounts only. No production data changes or release are included.
