# Totake MCP consent recovery

## Brief

Totake tools can be checked in AI & MCP connection settings while the bearer
grant has only Todo scopes. The settings group count currently presents selected
tools as available, and the missing-consent explanation is inside a disclosure.
Default OAuth requests also have no way to opt into Totake on the consent page.

Root AGENTS.md, apps/web/AGENTS.md and the wuff-contributor workflow apply.
Empire owns connection/consent composition; Totake's private domain and tools
retain their scope requirements. Existing dependency edits are outside this work.

Acceptance:

- [ ] Connection settings distinguish selected tools from tools with permission,
  with missing consent visible without opening individual tools.
- [ ] Default OAuth consent offers explicit, unchecked Totake read/write access.
- [ ] Explicit client scope requests remain bounded by the original request;
  existing grants, refresh, revocation, PKCE and account isolation stay intact.
- [ ] Regression tests cover effective availability and safe consent selection.
- [ ] Run typecheck, unit tests and relevant local consent/UI integration checks.

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

Draft. No implementation, deployment, production mutation or live recovery claimed.
