# Wuff Totake integration

October 25, 2026. Implementation in progress. Source of product behavior: Joreel’s local `wuff-to-take-handover-2026-10-25/BLUEPRINT.html`, sections 2–19. No personal screenshots, conversation exports or medication data are copied into the repository.

## Brief and acceptance

Build the approved Totake experience inside Empire using the current contributor skill and root/web AGENTS.md. Preserve invite-only accounts, Todo behavior, standalone Settings, explicit saves and online-only recovery. Private medicine data belongs only to its account; Todo membership and old OAuth grants convey no medicine access.

- [ ] Personal treatments, schedule revisions/exceptions, stable occurrences, immutable records/audit and count-only stock ledger. Atomic record/stock/Undo with retry IDs and concurrent-write protection.
- [ ] Daily/week/month overview, grouped selection/Taken/Done/Skip/Snooze, recorded history/Undo, setup/edit, as-needed entries, stock warnings/adjustments. Preserve DD-MM-YYYY, 24-hour time, current Wuff controls, responsive sidebar and keyboard recovery.
- [ ] Dedicated Totake read/write consent; complete shared-domain HTTP/MCP/native capabilities, explicit browser handoffs and actual adapter parity.
- [ ] Global and per-app notification pause/status/device controls with callback enforcement and no repeat backlog on resume. Todo keeps its delivery rules; Totake has no silent missed completion, expiry or inherited quiet-hour delay.
- [ ] Durable scheduling/current-state checks; secure actions cannot double-record or deduct; provider acceptance is distinct from user acknowledgement.
- [ ] Meaningful unit coverage, isolated integration, OAuth/revocation, browser 320/390/1280 and actual MCP controls. Real installed phone/watch delivery remains a release gate.

## Delivery and review

Additive Drizzle migration in the existing database, dedicated app-owned tables, no auth-managed changes. New scopes are opt-in and refresh cannot expand grants. Reuse current notification devices/transports/QStash instead of provisioning another service. Preparing code is authorized; migration execution, production configuration and release require explicit operational authorization. The prior migration 0018 authorization does not authorize new migrations. No preview writes before backend isolation is confirmed.

Do not import demo clocks, sample treatments, localStorage persistence or old shared-package snapshots. Liquid/drop medication supports schedules and records but no inventory. Units are inherited counted units; no conversion or dose advice. Cycles retain the handover’s explicit proposal acceptance and documented rare travel limits. Exact Android/watch/full-screen interactions require demonstrated platform support and review of any alternative.

## Verification plan

Unit tests: calendar/scheduling DST, occurrence identities and exceptions; selection/records/Undo/PRN; stock counts/exclusions/fractions; repeat/snooze and pause/resume; contract validation and exact retry recovery. Integration: two synthetic accounts, actual HTTP/MCP/native reads and writes, scope/consent/revocation, transactions, duplicate/concurrent operations, stale callbacks and provider-mocked delivery. UI: complete drafts/cancel, conflicts, lost committed response, reload and cross-client updates, narrow layout/focus.

Status: brief only; no new behavior or integration proof yet.
