# Totake MCP consent recovery

October 28 follow-up: PR #42's unioned-grant availability claim has an unresolved
P2 finding. The historical checks below do not prove that a client's older token
can use a newer grant. See [mixed-grant reporting and reconnection](mixed-grant-availability.md)
for the correction, token-specific verification and current limitations.

## Brief

Totake tools can be checked in AI & MCP connection settings while the bearer
grant has only Todo scopes. The settings group count currently presents selected
tools as available, and the missing-consent explanation is inside a disclosure.
Default OAuth requests also have no way to opt into Totake on the consent page.

Root AGENTS.md, apps/web/AGENTS.md and the wuff-contributor workflow apply.
Empire owns connection/consent composition; Totake's private domain and tools
retain their scope requirements. Existing dependency edits are outside this work.

Acceptance:

- [x] Connection settings distinguish selected tools from tools with permission,
      with missing consent visible without opening individual tools.
- [x] Default OAuth consent offers explicit, unchecked Totake read/write access.
- [x] Explicit client scope requests remain bounded by the original request;
      existing grants, refresh, revocation, PKCE and account isolation stay intact.
- [x] Regression tests cover effective availability and safe consent selection.
- [x] Run typecheck, unit tests and relevant local consent/UI integration checks.

## Surfaces and decisions

Existing getMcpToolPreferences / GET /api/v1/connections/tools and
get_mcp_tool_preferences retain the saved selection and granted scopes. No domain
mutation, schema, default scope, notification or production configuration change.
OAuth approval continues through /oauth/authorize/decision with the existing
admitted web actor, same-origin guard, validated client/redirect/resource and PKCE.
Optional consent is a browser handoff, never an MCP-accessible grant expansion.
The same MCP scope/selection gate continues to govern discovery and invocation.
No embedded MCP UI change: account permission approval belongs in the browser.

Unit plan: original defaults; explicit consent and denial of unexpected/duplicate
or unrequested scopes; effective selected/blocked/available states; existing SDK
discovery and disabled-call coverage. Integration and browser evidence pending.

## Verification

October 27, 2026, local isolated development:

- `pnpm typecheck` passed, including the browser harness.
- `pnpm test` passed 211 tests, no skips. New regressions in
  `tests/oauth-consent-policy.test.ts` cover no opt-in, read-only/read-write,
  write-only/duplicate/unoffered denial and explicit-request ceilings.
  `tests/mcp-tool-choices.test.ts` covers selected-but-denied, read-only writes,
  deselection, successful permission and unknown-tool denial, alongside SDK tests.
- `pnpm build` passed optimized web and MCP builds.
- Serial `tests/mcp-tool-choices.integration.test.ts` and
  `tests/totake.integration.test.ts` passed 3 tests, no skips: real HTTP/MCP parity,
  scopes, privacy, stale/concurrent/exact retries, consent and revocation; Totake
  notification tests use mocked providers and loopback disables publishing.
- `node --env-file=.env.local --import tsx scripts/verify-totake-mcp-consent.ts`
  passed in headless Chrome with real isolated OAuth/HTTP/MCP: selected Totake
  tools denied under Todo-only grant; Save does not grant access; explicit optional
  browser approval issues a working new Totake grant while the old token remains
  denied; explicit-scope expansion, unoffered/write-only scopes and foreign Origin
  rejected; Cancel returns access_denied; keyboard read selection and read/write
  dependency; 320/390/1280px overflow/screenshots and no page errors. All fixture
  grants are revoked on exit and MCP returns 401 afterward. Fixture connection
  metadata/preferences remain on the synthetic account; no real-user data changed.

Screenshots are local under `artifacts/totake-mcp-consent/`; consent and Settings
phone captures were visually inspected. Early harness attempts hit cookie import
and warning-placement errors; those were corrected before the successful run.

Draft PR #42. Current-head hosted checks and Codex review tracked on the PR.
No production deployment, live-account recovery, named production MCP-host UI,
physical device or screen-reader proof. Existing saved tool selections and grants
remain unchanged. New consent requires reconnecting in the AI client; clients
with explicit scopes must request Totake themselves. Approval is intentionally
unavailable as an MCP self-grant operation.
