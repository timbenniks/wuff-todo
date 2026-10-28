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
Live `gh api` PUT completed for ruleset 25908933. Fresh stored readback matched
the submitted payload exactly, and effective `rules/branches/main` readback
requires only `check` from app 15368. Compared with the preflight snapshot, the
only change is removal of the Contributor policy status entry. No merge,
application deployment, database write or provider operation was performed.

## Local verification

- `pnpm typecheck`: passed across workspaces and root scripts/tests.
- `pnpm test`: 186 passed, zero failed/skipped. The 25 tests removed with the
  retired policy account for the reduced count; application suites are unchanged.
- `pnpm build:guide`: passed, nine guide pages and 65 indexed components; generated
  hosted guide and portable contributor downloads use the updated guidance.
- `git diff --check`: passed.

`node scripts/verify-contributor-guide.mjs` passed against the local development
server: 320/390/1280px, copy/keyboard/navigation, downloads, raw-reference/workflow
parity, implementation/review routes and zero application API requests. The
harness checks that the raw reference includes the served workflow rather than
asserting the retired evidence marker. No application integration writes or
production operations were performed.

## Follow-up review

Current-head review found stale automated path-hint promises and the old evidence
marker assertion in the guide harness. Both are corrected; guide regeneration
passed. Live workflow 395255536 was disabled with `gh workflow disable` and API
readback confirmed `disabled_manually`, with no active runs. Historical failures
remain visible but cannot block merging.
