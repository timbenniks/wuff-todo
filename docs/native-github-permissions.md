# Native GitHub permission fixes — October 22, 2026

Installed testing reported two problems: new Work todos were rejected without optional GitHub scope, and Enable GitHub changes could end with “Sign-in was cancelled.” Native client version 0.1.1 contains the correction.

## Task creation

A client with task-write permission can create a task on an auto-issue Work list even without `github:manage`. That task stays local: the transaction creates neither a GitHub link nor a sync job. Repeating the same operation ID returns the same task, and later reconnecting or editing never backfills an issue. Clients with explicit GitHub permission keep the owner's automatic issue behavior and outbound-content validation. Existing linked task writes still require their existing synchronization permission. No database migration or binding change is needed.

This follows the user's October 22 correction and supersedes the previous requirement that basic clients reconnect before creating any Work todo. HTTP, native and MCP share the same domain service; MCP tool metadata now describes the local-only fallback.

## Permission-upgrade race

Interactive consent increments the native client's credential generation. Old list/live/image requests used to report generation mismatch as HTTP 401. The shared live adapter treated that as session loss, cleared credentials and incremented the generation again while the new code exchange was pending; the exchange consequently reported cancellation.

Superseded requests now use a distinct nonterminal `request_superseded` error. New API/image calls are held off during the credential exchange, and reads check their generation before dispatch and after the response/JSON boundary. A stale rejected refresh cannot be mistaken for a failure of the new grant. Genuine current-grant failures and explicit sign-out still clear credentials. Old returned credentials are revoked, and serialized secure storage continues to prevent late writes restoring signed-out data.

Permission-flow errors are visible in the mounted workspace, callbacks stay stable across error renders, and the GitHub action is disabled during a task mutation. Authentication denial/cancellation keeps the existing workspace available.

## Verification

- Focused native-client/feature-adapter tests passed 19/19, including a real adapter/client interaction with delayed live 401, concurrent permission exchange, gated new reads and successful use of the upgraded grant. A separate delayed invalid-grant refresh test covers the unsuccessful old-refresh path.
- Provider-mocked GitHub integration against the existing isolated development database passed. A basic grant creates exactly one local task on duplicate requests, creates no provider issue/link/job, preserves local notes, and remains unlinked after an authorized later edit. Existing automatic export, denied synchronized writes, conflicts, recovery, revocation and ownership cases remain covered.
- Full `pnpm check` passed 82 unit tests, workspace/root TypeScript and optimized web/MCP builds. Native frontend build passed. Installed phone/Windows acceptance remains in the existing device gate; compile and synthetic evidence are distinct from physical-device proof.
