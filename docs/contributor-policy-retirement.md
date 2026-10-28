# Contributor metadata policy retirement — October 28, 2026

Tim explicitly requested removal because the PR metadata gate repeatedly failed
while descriptions caught up with pushes. Copilot/Codex comments and the PR
template guide description quality. Exact JSON declarations and the synchronized
full-head evidence string are retired.

Removed: the privileged pull_request_target workflow, policy script and its 25
policy-only tests. Those tests exercise the deleted gate, so retaining them would
import a missing module. Application tests and test/CI settings are unchanged.
No replacement behavior or static-source tests are needed for this deletion.

No persisted application data, API/MCP operation, MCP App UI, OAuth grant,
connection, schema, dependency or deployment changes. Domain authorization,
API/MCP parity, unit coverage and the review/fix loop remain required.

## Main protection

Tim authorized removing only Contributor policy from ruleset 25908933. Preserve
Verify (`check`, GitHub Actions app 15368), strict up-to-date checks, PRs, resolved
threads, squash merging, deletion/force-push blocks and the existing bypass.
Live mutation/readback and local verification are pending.
