## Feature brief

<!-- Replace comments with the goal, intended users, included/excluded behavior,
preserved behavior and testable acceptance checkboxes: - [ ] Observable result.
Keep this brief proportional to the change and current as you iterate. No
preliminary approval, scope hash or approved file list is required. -->

## Scope

<!-- Identify files/components, interactions, test/doc changes and any schema,
auth, contracts, dependencies, global styles, native config or safeguard changes.
Highlight high-risk access/privacy, schema, permission, operational or safeguard
changes for Tim's final review. Routine implementation choices need no approval. -->

## API, MCP and connections

<!-- Include exactly one JSON block following docs/guide/surfaces.md.
Declare dataChanges, operations, mcpUi and connections. Every persisted mutation
needs action/domain/api/mcp/status/verification; status must be implemented.
No-data changes use dataChanges:false, operations:[] and noDataChangesReason.
MCP UI: implemented with verification, or not-needed with reason.
Connections: affected boolean and review; affected connections need verification.
Map existing or new routes/tools; no web-only writes or silent deferral. -->

## Unit tests

<!-- Include one JSON block. Behavior changes require:
{"required":true,"files":["tests/actual-feature.test.ts"],"verification":"Actual cases, command and results including boundary/failure behavior"}
Files must be added/updated in this PR. Integration-only files do not substitute.
Docs/style-only changes can use required:false with a concrete reason. Data
changes cannot waive coverage. Do not add empty tests just to pass this check. -->

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

## Review findings

<!-- Link the latest Codex review and its reviewed commit SHA. Summarize addressed
findings with fix commits and actual tests; request a fresh review after changes.
List unresolved/disputed findings for Tim, missing review/checks, or code changes
since the review. Resolving a thread is not evidence of a fix. No findings does
not prove tests passed or replace Tim's approval. -->

## Remaining work or risks

<!-- Explain unverified behavior, technical help, rollout steps and release gates.
Explain when no known risks remain. Tim owns merge and production release. -->
