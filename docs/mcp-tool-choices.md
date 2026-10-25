# Personal MCP tool choices

October 25, 2026. Users choose which tools each AI connection exposes. Tim wants
Todo without Totake. App/service switches plus advanced individual choices live
in Settings → AI & MCP connections. These choices are independent of web app
visibility, notification settings and OAuth permission grants.

Root/web AGENTS.md, contributor workflow/skill, surface and accessibility guides
apply. Prepare one additive account/client-owned preferences table; execution
requires explicit operational approval. No auth-managed tables are changed.

Acceptance:

- [ ] Each connection has explicit Save/Cancel tool choices and group switches.
- [ ] Tool discovery reflects granted scopes and the owner's allowlist. Disabled
  cached tool calls are rejected too; every MCP request reloads current policy.
- [ ] Selecting tools never grants OAuth scopes. Connection controls remain
  available when authorized; future optional tools stay off after explicit selection.
- [ ] User/client isolation, version conflicts and exact retry receipts hold across
  shared-domain HTTP/MCP/native adapters. Revoked connections cannot replay saves.
- [ ] No provider actions, real notifications, OAuth expansion or production writes.

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
