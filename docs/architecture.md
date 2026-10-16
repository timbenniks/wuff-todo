# Wuff Todo architecture

Status: implemented web/API/MCP architecture with explicitly marked future scope

Updated: October 16, 2026

The implemented foundation uses managed Neon Auth for login and `@node-oauth/oauth2-server` on Next.js for delegated MCP authorization. See [development and operations](development.md) for concrete endpoints, environment setup, and current limitations. Existing-account list invitations and membership management are implemented; see [sharing](sharing.md). Personal sidebar order, shared colors/descriptions, sections, and archive/restore are implemented in the [mature lists milestone](mature-lists.md). Native authentication, new-account invitation delivery, and future packages remain planned.

## Stack and deployment

Confirmed stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui primitives, Drizzle ORM, Neon Postgres, Neon Auth, and Vercel hosting. Provision Neon through the Vercel integration. Use the GitHub CLI and Vercel CLI in the development and delivery workflow.

The website, HTTP API, and MCP endpoint live in one Next.js application and one Vercel project. Mobile applications will have separate release pipelines within the same repository.

Private task-note images use Vercel Blob for bytes and Neon for task-bound attachment records. Current admission/list permissions authorize each delivery; Markdown uses stable application attachment references. Development and production use separate private Frankfurt stores. See [private task images](task-images.md) for lifecycle, APIs, MCP and verification status.

Use pnpm workspaces. Add build orchestration only when workspace dependencies and build times justify it. Pin supported package versions during implementation rather than treating this planning document as a version lock.

## Repository layout and future packages

```text
apps/
  web/                 Next.js website, API routes, MCP transport
  mobile/              Future Expo/React Native app for iOS and Android
packages/
  contracts/           Shared validation schemas, DTOs, error contracts
  domain/              Server-side list/task operations and permissions
  db/                  Drizzle schema, database access, migrations
  client/              Future typed HTTP client
  ui/                  Future shared web component package
  design/              Future shared design asset package
docs/
```

Create packages when they acquire real responsibilities. Do not scaffold an unused mobile application during the first phase.

## Request flow and package boundaries

```text
Website / future mobile ── HTTP API ──┐
                                    ├── Domain services ── Drizzle ── Neon
AI client / MCP App ────── MCP tools ─┘
```

- HTTP routes and MCP tools are adapters around the same domain operations.
- The website uses the versioned API for mutations. Server rendering may call those domain services directly with the same verified user context.
- Domain services enforce permissions on every operation and receive authenticated identity from trusted server code.
- Database credentials, auth secrets, domain implementation, and database packages never enter browser or mobile bundles.
- Contracts expose stable public representations, not raw database rows.
- The HTTP client and mobile application do not import server-only packages.
- Website and MCP App may share web components. Native mobile components share design tokens and assets, not browser-dependent shadcn components.

## Identity and authorization

Neon Auth is the chosen identity system. Validate the current managed service capabilities before selecting an integration. Old Neon examples based on Stack Auth are not evidence for the current managed Better Auth implementation.

Website sessions, future native sign-in, and delegated MCP authorization need explicit integration paths. A website login cookie alone does not authorize an external MCP client.

The first technical proof must establish:

1. Invitation-only account creation is enforced at the auth boundary, not merely hidden in the UI.
2. A user can sign in and retain a valid web session.
3. An external MCP client can discover authorization, obtain consent and appropriately scoped tokens, and call a protected tool.
4. The server validates token issuer, audience, expiry, and scopes and maps identity to the correct application user.
5. A user can revoke a client connection.
6. The selected integration has a viable native authentication path; mobile implementation remains deferred.

The implemented OAuth authorization layer delegates MCP access while preserving Neon identity. It uses application-owned OAuth tables and does not install upstream Better Auth plugins into the managed service.

Implemented MCP scopes are `lists:read`, `tasks:write`, and `lists:manage`. Codex tool interoperability is verified; other clients and named-host inline UI remain separate checks. List membership remains authoritative even when a token has a broad write scope.

## Conceptual data model

| Entity               | Responsibility                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| User/profile         | Stable link to Neon identity and application preferences                                              |
| List                 | Title, description, shared color, archived state, owner, timestamps, version                          |
| List membership      | Accepted editor membership, unique per list and user                                                  |
| Invitation           | Recipient user ID, list, email, expiry, acceptance and closed state                                   |
| User list preference | Account-owned ordered list IDs and independent revision; current access filters reads                 |
| List section         | List-bound title and shared integer position; removal preserves tasks                                 |
| Task                 | List, optional section, title, Markdown content, integer position, completion; version is on the list |
| Mutation receipt     | Actor, operation UUID, fingerprint, identifier result, creation time                                  |

The list owner is authoritative on the list row. Domain queries recognize owner access or accepted membership. Avoid competing sources of truth for ownership.

Auth-managed tables remain owned by the auth service. App schema changes are versioned through Drizzle migrations. The app owns OAuth client, authorization-code, and token tables for the implemented delegated authorization layer.

## Ordering, concurrency, and retries

Implemented behavior:

- Task positions are integers shared within a list; queries use task ID as a deterministic tie-breaker. Active-task reorder operations run transactionally.
- List mutation requests carry the expected list version. Stale writes return a 409 conflict; clients reread current state instead of silently overwriting another user's change.
- Completion/reopening set explicit state. Reopening appends the task to the active order.
- Retryable mutations accept actor-scoped operation IDs. Reusing an ID with different input is rejected. Receipts contain identifiers; services recheck current authorization before returning protected snapshots.
- Task writes and sharing changes serialize on the list row; invitation responses use the same row lock. Revocation cannot be bypassed by an old acceptance or mutation receipt.
- Personal sidebar ordering uses a separate account revision and serializes writes on the account row. It does not advance shared list versions. Reorder requests supply every currently accessible list once; new lists append, and revoked/deleted IDs are filtered on reads.
- Sections and owner metadata use the list lock/version. Task section IDs must belong to the same list. Archived task/section writes fail in domain services; sharing and owner metadata remain available.

The website uses Neon Realtime to subscribe to accessible list summaries and versions. The SQL definition lives in the domain package and includes enabled-profile and owner/member predicates, so removing membership removes the row from an existing subscription. Authenticated `POST /api/v1/live` seals the query for the verified actor; the secret stays on the server and capabilities stay in memory. Renewals check the page’s expected user ID, and list-page API requests also pin writes/reads to that identity to prevent an old tab operating under a newly signed-in account.

Live snapshots act as invalidation signals: a coalescing queue fetches authoritative API snapshots, defers during local writes, and repeats if another event arrives during a read. This preserves existing list-version and cache-generation safeguards instead of rendering potentially delayed replica state over newer local edits. Polling every ten seconds and focus/visibility refresh remain independent fallback paths. The SDK renews capabilities and reconnects; terminal subscription errors trigger a fresh subscription attempt. See [live updates](live-updates.md).

## HTTP API

The implemented `/api/v1` interface exposes lists, members, invitations, tasks, and AI connections. See [development](development.md) for routes. User preferences remain future work.

An OpenAPI description remains future work; when added, generate it from shared contracts or validate it against them. Specify pagination, input limits, stable error codes, conflict responses, and idempotency behavior. Unauthorized callers must not learn private list contents through errors.

Keep reorder and membership operations explicit. Do not expose generic database mutation endpoints.

## MCP and MCP Apps

The implemented endpoint is `/api/mcp`, using stateless Streamable HTTP with delegated bearer authentication. Its 25 tools are:

- `list_lists`, `get_list`, `create_list`, `rename_list`, `delete_list`.
- `update_list`, `get_list_order`, `reorder_lists`.
- `create_section`, `rename_section`, `reorder_sections`, `delete_section`.
- `create_task`, `update_task`, `delete_task`, `reorder_tasks`. `get_list` includes tasks; `update_task` explicitly sets completion/reopening.
- `get_list_sharing`, `list_invitations`, `invite_to_list`, `respond_to_invitation`, `cancel_invitation`, `remove_list_member`, `leave_list`.
- Interactive `show_lists` and `show_list` tools for MCP Apps.

Tools return structured results plus concise text independently of UI support. All tool calls enforce the same authentication, permission, validation, and concurrency rules as the website. The embedded UI handles lists/tasks; sharing tools return structured data and the website provides sharing controls.

MCP App packaging must respect host sandboxing and resource policies. Do not embed secrets in UI resources. Test an agreed client matrix rather than claiming support for every AI client.

## Web and mobile offline boundary

Confirmed October 15, 2026: preserve the website’s current online behavior. Its manifest and icon assets provide identity; do not extend them into offline-first PWA behavior. No service worker, durable offline task cache, or disconnected mutation queue is part of the current web scope. Transient in-memory list snapshots and retrying an uncertain online request are separate from offline editing. Live updates and reconnect reconciliation are implemented online features.

When React Native/Expo mobile planning starts, explicitly compare:

- Online-only operations with clear network failures.
- Cached read access while offline, with visible freshness and access/privacy rules.
- Queued offline edits, including retry/idempotency, conflict resolution, and honest pending/error states.

Choose based on actual iPhone/Android needs and the user’s experience with PWA/offline tradeoffs. Native offline-first behavior is not decided or promised. Evaluate secure local storage, account switching/sign-out cleanup, and what happens to cached data or queued edits after shared-list access is revoked. Record the decision before implementing persistence or synchronization.

## Environments and delivery

- Use local development, preview, and production environments with isolated credentials and data.
- Configure Neon through the Vercel integration; verify the selected integration's preview database and auth behavior.
- Do not casually copy the couple's private production lists into development or preview environments.
- Use synthetic seed data for functional testing.
- Run migrations as a controlled deployment step, not independently from every serverless request.
- Validate migrations on preview before production; document recovery for destructive changes.
- Keep credentials out of repository files, screenshots, and logs.
- Record request IDs and sanitized failures to diagnose API and MCP issues.

## Sources and validation boundary

Research reviewed October 15, 2026. Current integration evidence is recorded in [verification](verification.md); this architecture also contains planned behavior beyond that milestone.

- [Neon Auth overview](https://neon.com/docs/auth/overview)
- [Neon Auth plugin support](https://neon.com/docs/auth/guides/plugins)
- [Neon Auth roadmap](https://neon.com/docs/auth/roadmap)
- [Neon auth in Vercel previews](https://neon.com/blog/auth-that-just-works-in-vercel-previews)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps authorization](https://apps.extensions.modelcontextprotocol.io/api/documents/authorization.html)
- [Expo documentation](https://docs.expo.dev/)
- [shadcn/ui documentation](https://ui.shadcn.com/docs)

## Existing-account sharing

The list owner controls invitations and membership. A recipient must already have an enabled Wuff profile; managed identity alone is insufficient. Invitations reference the recipient ID and are accepted only by that actor. Legacy token hashes remain stored for schema compatibility but are not authorization credentials, are never exposed, and are not used by the in-app flow.

All sharing mutations and task writes lock the same list row and use its version. Acceptance/decline lock the list before rechecking invitation state. Cancellation and acceptance cannot both commit; a concurrent task write and revocation either serialize or fail with a stale-version conflict. Operation receipts store identifiers, and acceptance retries recheck current access instead of recreating membership. Read snapshots use repeatable-read transactions where multi-query consistency is required.

## Task notes

Tasks have canonical Markdown `content` (16,000 characters, empty by default), included in authorized snapshots. HTTP and MCP create/update adapters use the same contracts and domain mutation services, so versioning, admission, membership, archive restrictions and live invalidation apply unchanged. The website lazily loads Tiptap; the MCP App edits source with a live preview. Both share a Markdown-it renderer with HTML disabled, restricted links and non-loading image placeholders. See [task content and voice](task-content.md) for conversion safeguards, draft handling, the additive migration and the corgi copy decisions.
