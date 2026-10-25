# Reminder publication recovery — October 25, 2026

## Brief

Root AGENTS.md and the wuff-contributor skill govern this shared server fix.
Todo and Totake scheduling currently send colon-separated QStash deduplication
IDs. The provider rejects these requests with HTTP 400: `DeduplicationId cannot
contain ':'`. Tim's 21:50 Europe/Paris reminder remained pending with no message
ID or delivery receipts. Browser devices were registered and pauses/quiet hours
were off. Tim authorized one retry of that existing reminder; it returned the
same error and sent nothing.

Acceptance:
- [ ] Todo and Totake publish provider-compatible, deterministic deduplication IDs.
- [ ] IDs distinguish product, job, version and minute; identical retries deduplicate.
- [ ] Scheduling retains the six-day hop, future minimum, five retries and job-only payload.
- [ ] Provider rejection propagates to existing callers, which retain durable pending rows.
- [ ] Regression unit tests cover accepted requests and failed publication; relevant existing integration checks pass.

Shared publishing belongs in Empire's scheduler; product services retain their
own job tables, permissions, pauses, delivery gates and scheduling reconciliation.
No schema, public API/MCP contract, scope, consent, UI, dependency, native
permission or production configuration change. Existing HTTP/MCP/native reminder
mutations share the corrected domain scheduler. No new MCP App UI is needed for
an internal provider encoding fix. Missing/revoked grants retain existing guards.

No production data edits, new sends or release are part of preparing this fix.
No manual previews, per Tim's earlier request. Real provider/device delivery must
be verified after merge/deployment; configured credentials alone do not prove it.

## Verification

Pending implementation and local checks. Hosted CI may remain blocked by account
billing. Tim retains merge/release ownership.
