# Personal MCP tool choices

October 25, 2026. Users choose which tools each AI connection exposes. Tim wants
Todo without Totake. App/service switches plus advanced individual choices live
in Settings → AI & MCP connections. These choices are independent of web app
visibility, notification settings and OAuth permission grants.

## Selected tools and missing consent

Connection settings distinguish selected tools from tools with permission. A
checked Totake group can still have zero tools with permission under a Todo-only
grant. Missing consent is visible above the groups and on each group, including
after saving; refreshing tools does not grant it.

Reconnect through the AI client to approve Totake. When the client omits `scope`,
the consent page offers unchecked Read Totake and Change Totake choices; write
requires read. Leaving them unchecked preserves the original Todo-only defaults.
Clients sending explicit scopes must request `totake:read` and, for actions,
`totake:write` themselves. Optional selections cannot broaden an explicit request.
Existing tokens and refresh scope ceilings are unchanged. Approval creates a new
grant; old tokens remain limited. See [consent recovery](totake-mcp-consent-recovery.md).

Root/web AGENTS.md, contributor workflow/skill, surface and accessibility guides
apply. Prepare one additive account/client-owned preferences table; execution
received explicit operational approval for development and production. No auth-managed tables are changed.

Acceptance:

- [x] Each connection has explicit Save/Cancel tool choices and group switches.
- [x] Tool discovery reflects granted scopes and the owner's allowlist. Disabled
      cached tool calls are rejected too; every MCP request reloads current policy.
- [x] Selecting tools never grants OAuth scopes. Connection controls remain
      available when authorized; future optional tools stay off after explicit selection.
- [x] User/client isolation, version conflicts and exact retry receipts hold across
      shared-domain HTTP/MCP/native adapters. Revoked connections cannot replay saves.
- [x] No provider actions, real notifications, OAuth expansion or production integration writes.

Surfaces: getMcpToolPreferences ↔ GET /api/v1/connections/tools?clientId=… ↔
get_mcp_tool_preferences; updateMcpToolPreferences ↔ PUT same endpoint ↔
update_mcp_tool_preferences. Native bearer actions/client mapping also provided.
Reads require empire:read; changes additionally empire:manage. MCP App UI is not
duplicated: structured tools provide full capabilities and an explicit secure
website setupPath for this account/connection configuration.

Plan meaningful tests for catalog coverage/actual SDK discovery and disabled calls,
scope ceiling, group toggles, validation, ownership/revocation, stale/concurrent
writes, identical versus changed retries, token rotation and real API/MCP/native
parity. Check synthetic browser Save/Cancel, failures/retained drafts, mobile fit
and catalog-refresh guidance. Run typecheck/unit/build and guarded development
integration after migration authorization. Keep draft if any required check blocked.

## Final behavior and security boundary

The catalog names every registered MCP tool and its existing domain scopes.
The actual SDK registration path enforces both the catalog and the owner selection:
SDK-disabled tools are omitted from discovery and reject cached calls before their
callbacks run. Unknown registrations fail closed. Every authenticated MCP POST
loads its user/client policy again; nothing is cached across requests.

An absent preference row preserves existing authorized tools. Saving creates an
explicit allowlist: newly added optional tools remain off until chosen. Selection
never changes OAuth scopes, app/menu visibility, notifications or provider grants.
Connection read/update/disconnect controls cannot be unchecked, but still require
their own granted scopes. Existing grants and refresh defaults are unchanged.

The verified MCP bearer adapter supplies `Actor.mcpClientId`; callers cannot
supply it through tool arguments. MCP actors may narrow any owned connection's
selection but cannot re-enable tools, including indirectly through another client.
Owner website/native actors can re-enable selections. This deliberate safety
boundary keeps an AI client from undoing the owner's restrictions; structured
MCP reads return the website setupPath and canEnable=false.

Writes serialize by actor/operation and actor/client, check active admission and
owned unrevoked MCP grants before receipt replay, compare optimistic versions and
reject changed reuse of an operation ID. Expired connections remain configurable
in owner Settings, with no active granted scopes; expired/revoked bearer tokens
cannot use MCP. Revocation and consent remain the existing connection workflows.
The UI keeps the exact save payload after ambiguous failures and offers explicit
retry or Load latest choices; conflicts preserve the unsaved selection.

A partial advanced selection can hide an MCP App's supporting tools too. The host
will receive the same authorization rejection as tool-only clients. No second
security editor is embedded in an MCP App. Native bearer operations and explicit
NativeClient/featureApi mappings supply equivalent capabilities; there is no
native permission, dependency, provider action or notification change.

## Migration execution

Tim explicitly authorized migration 0020 for **development and production** in
this conversation. It was applied to both on October 25 using the existing direct
connections. The guarded runner checked all 20 existing migration hashes, applied
only 0020, verified its four columns and read back unchanged snapshots of existing
users, lists, tasks and members. Only the new account/client-owned table was added;
no existing rows or auth-managed tables changed. This is schema deployment only,
not application release or production integration testing.

## Verification — October 25, 2026

- `pnpm typecheck` passed workspaces and root scripts/tests. `pnpm test` passed
  **172 tests in 31 discovered unit files**, zero skips. The six new cases in
  `tests/mcp-tool-choices.test.ts` cover scope ceilings and legacy context reads,
  unknown/locked tools, group preservation, empty/duplicate/invalid/spoofed input, MCP narrowing versus owner recovery,
  actual SDK discovery/cached-call denial and native route payload/error mapping.
- `pnpm build` passed guide/MCP generation and optimized web compilation.
  `pnpm build:native:web` passed; its existing >500kB bundle advisory remains.
- Development-only `node --env-file=.env.local --import tsx --test
--test-concurrency=1 tests/mcp-tool-choices.integration.test.ts` passed. The real
  cookie HTTP, stateless MCP and native bearer adapters prove API-write/MCP-read,
  MCP-write/API-read, native re-enable/API-read, independent clients/accounts,
  scopes/origin/account guards, stale and concurrent saves, exact versus changed
  retries, admission rejection on receipt replay, expiry/revocation, refresh and
  explicit re-consent without resetting choices. Temporary preferences/receipts
  were removed and fixture grants revoked.
- Existing `tests/empire-adapters.integration.test.ts` and
  `tests/totake.integration.test.ts` each passed against the same optimized local
  app and real development services. Empire's insufficient-scope assertions now
  expect SDK-disabled rejection before domain dispatch; authorization is retained.
- Chrome via CUA proved per-connection deep link, group and advanced choices,
  Save/persistence after reload, Cancel, mixed group state, keyboard Space/focus,
  320/390/1280px layouts and no horizontal overflow at both phone widths. A local
  loopback-only fault proxy committed a real save then replaced the response with
  502; Retry succeeded with identical body hashes, including UUID/version. A real
  concurrent domain save produced a visible conflict while preserving the draft;
  Load latest replaced it with saved state. No browser console errors observed.
  Screenshots: [desktop saved choices](screenshots/mcp-tool-choices/desktop-saved.png),
  [320px advanced choices](screenshots/mcp-tool-choices/phone-320.png),
  [390px advanced choices](screenshots/mcp-tool-choices/phone-390.png).
- These are local browser/protocol/development-service checks. No newly configured
  production ChatGPT connection, installed native device or screen-reader test is
  claimed. Preview backend isolation is unconfirmed, so no preview data writes.

PR #31 remains a draft while GitHub's required checks are blocked by account
billing. Tim retains merge and application-release authority. Existing local
package/lock/workspace edits are excluded. No dependency, global styling, native
permission or OAuth-scope/default changes are part of this feature.
