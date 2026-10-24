## Feature brief

<!-- Replace comments with the goal, intended users, included/excluded behavior,
preserved behavior and testable acceptance checkboxes: - [ ] Observable result.
Tim approves a hash of this brief AND the surface scope fields below. Capability
or UI/connection decisions changing need renewed approval; evidence can evolve. -->

## Scope

<!-- Identify files/components, interactions, test/doc changes and any schema,
auth, contracts, dependencies, global styles, native config or safeguard changes.
Explain sensitive changes and request Tim's approval. -->

## API, MCP and connections

<!-- Include exactly one JSON block following docs/guide/surfaces.md.
Declare dataChanges, operations, mcpUi and connections. Every persisted mutation
needs action/domain/api/mcp/status/verification; status must be implemented.
No-data changes use dataChanges:false, operations:[] and noDataChangesReason.
MCP UI: implemented with verification, or not-needed with reason.
Connections: affected boolean and review; affected connections need verification.
Map existing or new routes/tools; no web-only writes or silent deferral. -->

## Preview

<!-- Link the Vercel deployment for the evidence commit and give test steps.
Name who confirmed backend isolation. Use synthetic data only. If unavailable,
explain the blocker and local evidence. Do not write to an unverified backend. -->

## Verification

<!-- Include Evidence commit: FULL_CURRENT_HEAD_SHA and actual commands/results.
UI: 320/390px and desktop screenshots, keyboard/focus, labels, long content,
overflow and relevant loading/empty/error/denied/conflict/retry behavior.
Server: relevant permission, idempotency, concurrency and API/MCP regression proof.
Performance: measurements when affected. Distinguish mocks/local/preview/device
proof. Rerun affected checks after code changes; do not relabel old results. -->

## Remaining work or risks

<!-- Explain unverified behavior, technical help, rollout steps and release gates.
Explain when no known risks remain. Tim owns merge and production release. -->
