# Production MCP validation

October 15, 2026

Endpoint: `https://wuff-todo.vercel.app/api/mcp`.

## Current catalog and later sharing checks

The deployed catalog now has 18 tools: the original 11 below plus `get_list_sharing`, `list_invitations`, `invite_to_list`, `respond_to_invitation`, `cancel_invitation`, `remove_list_member`, and `leave_list`. Authenticated production Codex calls validated sharing reads and rejection of self-invitation without mutation; development tests exercised the two-user sharing lifecycle through both HTTP and MCP. See [verification](verification.md#existing-account-sharing--october-15-2026).

Tim also reported successful use in another Codex chat. This does not verify ChatGPT, another person's authorization, or inline rendering in a named host.

## Connection status — October 16, 2026

The earlier successful checks below remain historical evidence. A new attempt through the saved Codex connection failed before tool discovery: its OAuth refresh grant returned `invalid_grant` / authorization required. The connection needs interactive reauthentication before further production MCP testing. The reason the grant became invalid was not established, and no production fixture was created through this failed attempt.

Authenticated synthetic development MCP tests passed with live subscriptions. Production live transport was separately verified through trusted server domain services, including task addition/completion and disposable-list cleanup; this does not substitute for a production remote MCP client check. See [live updates](live-updates.md#verification).

## Initial Codex result (before sharing tools)

Codex CLI 0.160.0 successfully authenticated using Dynamic Client Registration, S256 PKCE, the production resource indicator, and the user's interactive Wuff sign-in/consent. The connection is saved as `wuff-todo` in the user's Codex configuration. OAuth credentials are managed by Codex, not copied into the repository or test scripts.

The real Codex app-server MCP runtime then performed these checks against production:

| Check                                       | Result                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Unauthenticated GET/POST                    | 401 with protected-resource metadata challenge                                     |
| Resource and authorization-server discovery | Production issuer/resource and supported endpoints/scopes correct                  |
| Invalid token exchange and foreign Origin   | Rejected                                                                           |
| Authenticated initialization/tool discovery | 11 tools discovered; no discovery error                                            |
| MCP App resource retrieval                  | `ui://wuff/lists.html`, `text/html;profile=mcp-app`, self-contained HTML delivered |
| `list_lists`                                | Accessible lists read successfully; contents not logged                            |
| `create_list` and identical retry           | One disposable list; retry returned the same ID                                    |
| `create_task`, `update_task`, `show_list`   | Task added, completed, and completion read back                                    |
| Stale-version mutation                      | Rejected                                                                           |
| `get_list`, `delete_list`                   | Disposable list reread and cleaned up with its task                                |

Tool calls used an ephemeral protocol context with no model turn or persistent user chat. This proves Codex runtime interoperability; it is not evidence of a natural-language model selecting every tool correctly. User lists were read only; writes were confined to a newly created disposable validation list, which was deleted afterward. The authorization was connected at that time; see the October 16 connection status above.

The initial 11-tool catalog contained `create_list`, `create_task`, `delete_list`, `delete_task`, `get_list`, `list_lists`, `rename_list`, `reorder_tasks`, `show_list`, `show_lists`, and `update_task`. Catalog discovery is distinct from exercising every tool or permission combination.

## Reconnecting Codex

For a new installation:

```sh
codex mcp add wuff-todo --url https://wuff-todo.vercel.app/api/mcp
```

For an existing configuration needing login:

```sh
codex mcp login wuff-todo --oauth-client-registration dcr
```

Let Codex discover the resource. In the installed CLI, supplying `--oauth-resource` persisted an `oauth_resource` override and produced duplicate `resource` parameters alongside automatic discovery. Wuff correctly rejected that ambiguous request. Removing the redundant override from the Wuff-only configuration entry resolved it; no server validation was weakened.

The connection may need a server restart in the desktop client's MCP settings before it appears in an already-open chat. See [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Remaining verification

- Render the interactive list view in a real supporting host and test adding/completing tasks through its bridge. Resource retrieval through Codex passed, but desktop inline rendering was not verified. OpenAI documents the iframe experience in ChatGPT: [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui).
- Broaden recorded natural-language coverage beyond the user-reported successful Codex use; keep model/tool-selection evidence separate from direct protocol checks.
- Production token refresh/rotation and user-driven disconnection remain separate checks; synthetic development integration tests cover refresh, revocation, read-only scopes, and permissions. The production validation deliberately preserved the user's working connection.
- Joreel's own connection, ChatGPT, Claude, and other clients remain unverified. One person's successful consent does not verify another account.
