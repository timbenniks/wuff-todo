# Wuff Todo architecture

Status: working architecture; foundation implemented

Updated: October 15, 2026

The implemented foundation uses managed Neon Auth for login and `@node-oauth/oauth2-server` on Next.js for delegated MCP authorization. See [development and operations](development.md) for concrete endpoints, environment setup, and current limitations. Requirements below that concern invitations, native authentication, sidebar ordering, or future packages remain planned.

## Stack and deployment

Confirmed stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui primitives, Drizzle ORM, Neon Postgres, Neon Auth, and Vercel hosting. Provision Neon through the Vercel integration. Use the GitHub CLI and Vercel CLI in the development and delivery workflow.

The website, HTTP API, and MCP endpoint live in one Next.js application and one Vercel project. Mobile applications will have separate release pipelines within the same repository.

Use pnpm workspaces. Add build orchestration only when workspace dependencies and build times justify it. Pin supported package versions during implementation rather than treating this planning document as a version lock.

## Intended repository layout

```text
apps/
  web/                 Next.js website, API routes, MCP transport
  mobile/              Future Expo/React Native app for iOS and Android
packages/
  contracts/           Shared validation schemas, DTOs, error contracts
  domain/              Server-side list/task operations and permissions
  db/                  Drizzle schema, database access, migrations
  client/              Typed HTTP client
  ui/                  Web components for website and MCP Apps
  design/              Design tokens, icons, corgi assets
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

Whether an additional OAuth authorization layer is required is unresolved. Preserve Neon identity while evaluating this. Do not assume Neon exposes arbitrary upstream Better Auth plugins. Any change to the agreed auth stack requires an explicit architecture decision.

Proposed MCP scopes separate reading, task writes, and list management. Exact scopes and supported clients are selected in the proof. List membership remains authoritative even when a token has a broad write scope.

## Conceptual data model

| Entity               | Responsibility                                                                     |
| -------------------- | ---------------------------------------------------------------------------------- |
| User/profile         | Stable link to Neon identity and application preferences                           |
| List                 | Title, owner, lifecycle state, timestamps, version                                 |
| List membership      | Accepted editor membership, unique per list and user                               |
| Invitation           | Invited identity, list, inviter, token digest, expiry, acceptance/revocation state |
| User list preference | Personal sidebar order and future personal preferences                             |
| Task                 | List, title, order, completion state/time, creator, timestamps, version            |
| Mutation receipt     | Deduplication key, actor, operation fingerprint, stored outcome, expiry            |

The list owner is authoritative on the list row. Domain queries recognize owner access or accepted membership. Avoid competing sources of truth for ownership.

Auth-managed tables remain owned by the auth service. App schema changes are versioned through Drizzle migrations. Additional OAuth tables depend on the selected authorization solution.

## Ordering, concurrency, and retries

Proposed initial behavior:

- Sidebar position belongs to the user/list relationship.
- Task position belongs to the task within its list and is shared.
- Use transactional ordering operations with a deterministic tie-breaker. Choose the concrete position representation during implementation.
- Mutations include an expected version where stale edits could overwrite another change. Return a conflict with current state instead of silently losing edits.
- Serialize or version list reorder operations so concurrent moves cannot corrupt ordering.
- Completion and reopening are explicit state-setting operations, not a blind toggle.
- Creates and retryable bulk operations accept idempotency keys scoped to actor and operation. Reusing a key with different input is rejected.
- Membership checks and mutations must have transaction semantics that prevent a concurrent revocation from being bypassed.

Choose polling, refetch-on-focus, or push updates based on deployment suitability and the agreed freshness requirement. No realtime provider is selected yet.

## HTTP API

Use a versioned `/api/v1` interface. Proposed resources are lists, list members, invitations, tasks, and user preferences.

Publish an OpenAPI description from shared contracts or keep it validated against them. Specify pagination, input limits, stable error codes, conflict responses, and idempotency behavior. Unauthorized callers must not learn private list contents through errors.

Keep reorder and membership operations explicit. Do not expose generic database mutation endpoints.

## MCP and MCP Apps

Proposed endpoint: `/api/mcp`, using the supported remote MCP HTTP transport. The tool catalog maps to domain capabilities, for example:

- `list_lists`, `get_list`, `create_list`, `rename_list`, `delete_list`.
- `list_tasks`, `create_task`, `update_task`, `complete_task`, `reopen_task`, `delete_task`, `reorder_tasks`.
- Membership/invitation tools once their lifecycle and confirmation behavior are settled.
- Interactive `show_lists` and `show_list` tools for MCP Apps.

Final names and granularity are decided during the proof. Return structured results plus concise text so tools remain useful without UI support. UI tool calls pass through the same authentication, permission, validation, and concurrency rules.

MCP App packaging must respect host sandboxing and resource policies. Do not embed secrets in UI resources. Test an agreed client matrix rather than claiming support for every AI client.

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
