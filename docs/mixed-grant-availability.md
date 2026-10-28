# Mixed OAuth grants and tool availability

## Brief and correction

PR #42's unresolved [P2 finding](https://github.com/timbenniks/wuff-todo/pull/42#discussion_r4394603525)
is present on main `14caf1b5e7062d83d6ba44027c4f751e9a41d4a5` (checked October 28,
2026). Settings receives `grantedScopes` from
`packages/domain/src/platform/mcp-tools.ts`: the union of non-revoked,
refresh-unexpired MCP grants for the account/client. A client may hold an older,
Todo-only refresh token even when a newer Totake grant contributes to that union.
The union can also combine scopes that no single grant holds together.

GitHub records a successful Vercel status ("Deployment has completed") for this
merge at October 27, 21:51:08 UTC, pointing to
[deployment 2ujYgtf7f9AEQ9hCGju6i9ycdVyP](https://vercel.com/tim-benniks-projects-1b967033/wuff-todo/2ujYgtf7f9AEQ9hCGju6i9ycdVyP).
That status is additional deployment evidence, not independent verification of
the production alias, running UI or a recovered live ChatGPT authorization.

Root AGENTS.md, apps/web/AGENTS.md and wuff-contributor apply. Empire owns this
reporting-only correction. No stored selection, OAuth policy, schema, scope,
dependency, API/MCP operation or production configuration changes.

Acceptance:

- Settings uses a grant-summary helper that never reports positive authorization.
- Selected counts, absent-consent warnings and Save feedback remain visible;
  even complete aggregate scope coverage says client access is unverified.
- Actual token policy continues denying old grants and disabled tools.
- Regression coverage includes mixed grants, split scopes, missing/read-only
  consent, deselection, unknown tools and actual SDK discovery/denied invocation.

The smallest correction uses the review's aggregate-reporting option. It does
not choose the newest grant, silently upgrade old tokens, or treat the union or
intersection as the client's actual token. `mcpToolAvailability` is retained for
one verified grant/token only; browser settings uses `mcpToolGrantSummary`.
`McpToolPreferences.grantedScopes` is documented as aggregate for all consumers.
Existing HTTP/MCP preference reads retain their contract and authorization gates.
Consent still belongs in the secure browser, so no embedded MCP UI is required.

## Establishing access reliably

| Evidence                                                   | What it establishes                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tool appears in ChatGPT's tool catalogue                   | The host exposes a callable schema; it may be stale or disabled.                            |
| Tool is checked in Wuff Settings                           | Saved client selection allows it; no OAuth consent is added.                                |
| Client grant summary includes Totake scopes                | Some active grants collectively contain those scopes; the host's token is unknown.          |
| Fresh MCP `tools/list` with the host's actual bearer token | Discovery allowed by that token's scopes and the current saved selection at that time.      |
| Successful read through that same host connection          | Actual authorization for that read at that time, including current admission/domain access. |
| Read succeeds                                              | Does not prove write permission, delivery of reminders, or that every other tool works.     |

A diagnostic implemented later should derive scopes from the authenticated MCP
actor only for its own verified `mcpClientId`. A caller-supplied client ID must
never select another grant and present it as the current token. Browser cookies
and aggregate connection listings cannot establish the host's bearer scopes.
Do not put tokens in chat or logs. Classify disabled, insufficient-scope and
expired/revoked errors separately where the server exposes them. A generic
"disabled" response alone does not distinguish missing consent from deselection.

On October 28 this chat exposed `get_totake_summary`, but an actual read-only
call returned `Tool get_totake_summary disabled`. That establishes a blocked
call now, not the exact reason or the token's scopes. It cannot reconstruct which
tools ChatGPT could actually use on October 27. Historical proof needs a dated
successful call or token-specific server evidence from that connection.

## Deployment and reconnection

1. Tim reviews/merges and verifies a production release includes both PR #42's
   consent changes and this reporting correction. A merge or passing tests alone
   is not deployment or live-account recovery evidence.
2. In Wuff's AI & MCP settings, select the desired Totake tools. Saving selections
   does not grant access. If previously explicitly deselected, new consent will
   not automatically re-enable them.
3. Disconnect the Wuff connection in ChatGPT and start a new OAuth connection.
   If the client keeps reusing an old grant, explicitly revoke the matching AI
   client in Wuff Settings, then reconnect. Wuff's client-wide disconnect revokes
   every grant for that account/client; other sessions using it must reconnect.
4. Sign in to the intended Wuff account. On omitted-scope consent select Read
   Totake; also select Change Totake only if actions are wanted (write requires
   read). When the client requests explicit scopes, it must itself request
   `totake:read` and, for actions, `totake:write`; Wuff cannot expand its request.
   If choices are absent, correct the client request/configuration and restart.
5. Complete the callback so ChatGPT stores the newly issued token. Refreshing
   the older refresh token never acquires a newer grant's consent. Reloading
   Wuff or merely refreshing the tool catalogue cannot upgrade that token.
6. Refresh/discover tools in ChatGPT (start a fresh chat if the host retains an
   old catalogue), then invoke `get_totake_summary` through that connection.
   Confirm a successful result rather than only a listed tool. Confirm write
   scope from token-specific evidence; do not change medication records just
   to probe permission. Real medication actions require the user's instruction.

## Verification status

Local verification on October 28, using Node 22.23.4 and pnpm 10.33.3:

- Frozen dependency installation completed without dependency/lockfile changes.
- `pnpm typecheck` passed across workspace packages and root tests/scripts.
- `pnpm test`: 213 passed, zero failures/skips.
- Focused `node --import tsx --test tests/mcp-tool-choices.test.ts`: 8 passed,
  including actual in-memory MCP SDK discovery and denied old-scope invocation.
- A temporary mutation that treated complete aggregate coverage as authorized
  failed both new regression cases (2 failures). Restoring the correction passed
  all 8 focused cases. No mutated source remains.
- `pnpm build` passed optimized web/MCP compilation. This proves compilation,
  not a deployed or authenticated browser recovery.
- Changed-file Prettier and `git diff --check` passed.

The expanded real OAuth/browser harness `scripts/verify-totake-mcp-consent.ts`
covers mixed-grant feedback before/after Save, 320/390/1280px layouts and
old-token refresh denial. It has not run in this checkout. Its new mixed-grant
expectation rejects the former “4 selected · 4 with permission” browser outcome.

The isolated database/auth environment and `.vercel/dev-users.json` are absent
here. The real OAuth/browser harness and integration suites cannot run safely
in this checkout; no production substitute is used. They remain required checks
for Tim's isolated development environment. No deployment or successful live
account recovery is claimed.
