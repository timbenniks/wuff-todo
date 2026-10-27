# Product notification delivery urgency

Tim requested fixed product policy: Totake pushes always use high Web Push urgency;
Todo task/daily reminders use normal urgency. Root AGENTS.md and wuff-contributor
apply. Branch starts at latest main 0aaecd1. Product domain delivery constructs the
policy; the shared transport supplies the actual Web Push urgency header.

- [ ] Totake initial/repeat/private/grouped/retry delivery remains high urgency.
- [ ] Todo task/daily/private reminders explicitly remain normal urgency.
- [ ] Keep scheduling, pause/privacy, device access, receipts and stock behavior.
- [ ] Unit tests inspect actual SDK request headers and unchanged browser payload;
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
