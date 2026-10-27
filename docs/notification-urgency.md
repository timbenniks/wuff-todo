# Product notification delivery urgency

Tim requested fixed product policy: Totake pushes always use high Web Push urgency;
Todo task/daily reminders use normal urgency. Root AGENTS.md and wuff-contributor
apply. Branch starts at latest main 0aaecd1. Product domain delivery constructs the
policy; the shared transport supplies the actual Web Push urgency header.

- [x] Totake initial/repeat/private/grouped/retry delivery remains high urgency.
- [x] Todo task/daily/private reminders explicitly remain normal urgency.
- [x] Keep scheduling, pause/privacy, device access, receipts and stock behavior.
- Unit tests inspect actual SDK request headers and unchanged browser payload;
      isolated callback tests verify real producer policy and existing guards.

This changes a server delivery policy, not saved preferences or API/MCP writes.
Existing HTTP/MCP reminder capabilities and shared services remain unchanged.
No schema/migration, settings UI, MCP UI, scope/consent/provider connection changes,
new dependency, native client or production operation. Importance is not inferred
from optional interactive-action metadata, which may be trimmed for payload size.

High urgency requests prompt delivery; it does not set Android notification-channel
importance, override Do Not Disturb, force sound/vibration or guarantee receipt.
No browser presentation change is included. No live notification send is authorized
or needed for the local regression; provider request creation can be verified
without network sends. Final commands/results and review evidence belong in the PR.

## Verification record

The new SDK-header regression fails before the fix (`normal` instead of `high`).
After implementation, the two focused cases pass: high/normal actual encrypted
SDK request headers and unchanged notification body/TTL/timeout; high-urgency
expired-device versus temporary-outage classification and one send per attempt.
`pnpm typecheck`, `pnpm test` (206 passed, zero failed/skipped) and `pnpm build`
pass. Product callback integration assertions cover normal Todo task/daily payloads
and high Totake private/grouped payloads, partial-device retry and existing
permissions/receipts/stock protections. Final isolated integration, hosted CI and
latest-head Codex review results are recorded in the feature PR.

No presentation/UI changes: the worker receives the same notification payload
after server delivery metadata is removed. Existing HTTP/MCP capabilities are
unchanged, so there is no new persisted-data surface or consent to integrate.
