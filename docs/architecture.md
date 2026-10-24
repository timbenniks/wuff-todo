# Wuff Todo architecture

Status: implemented web/API/MCP architecture with explicitly marked future scope

Updated: October 24, 2026

The implemented foundation uses managed Neon Auth for login and `@node-oauth/oauth2-server` on Next.js for delegated MCP authorization. See [development and operations](development.md) for concrete endpoints, environment setup, and current limitations. Existing-account list invitations and membership management are implemented; see [sharing](sharing.md). Personal sidebar order, shared colors/descriptions, sections, and archive/restore are implemented in the [mature lists milestone](mature-lists.md). Native authentication and the shared Tauri workspace are implemented; installed-platform/signing acceptance and new-account invitation delivery remain separate gates.

## Stack and deployment

Confirmed stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui primitives, Drizzle ORM, Neon Postgres, Neon Auth, and Vercel hosting. Provision Neon through the Vercel integration. Use the GitHub CLI and Vercel CLI in the development and delivery workflow.

The website, HTTP API, and MCP endpoint live in one Next.js application and one Vercel project. The Tauri application has its own native build/release pipeline in the same repository.

Private task-note images use Vercel Blob for bytes and Neon for task-bound attachment records. Current admission/list permissions authorize each delivery; Markdown uses stable application attachment references. Development and production use separate private Frankfurt stores. See [private task images](task-images.md) for lifecycle, APIs, MCP and verification status.

Use pnpm workspaces. Add build orchestration only when workspace dependencies and build times justify it. Pin supported package versions during implementation rather than treating this planning document as a version lock.

DM Sans upright/italic variable assets and their OFL license live in `apps/web/src/fonts`. The root layout uses `next/font/local`; the standalone MCP build embeds those same files, requiring no external font domain. Web native selects preserve browser/keyboard semantics with a decorative inset chevron; native details/summary retain disclosure state and keyboard behavior. See [typography](typography-review.md) and [design language](design-language.md).

[GitHub issue synchronization](github-sync.md) adds owner-verified personal installations, encrypted expiring credentials, durable jobs and signed webhooks. The visual release remains separate; agent-run services are still deferred.

## Repository layout

The [design language and list themes](design-language.md) use a pure, client-safe palette derivation in `packages/design` and shared CSS in `packages/ui`. Web renders selected-list tokens on its container and synchronizes the document root for gutters/dialogs; MCP applies the same palette to its standalone document. No theme state or database table is added, and the existing owner-controlled list color remains authoritative. Status/danger colors retain their semantic meaning.

```text
apps/
  web/                 Next.js website, API routes, MCP transport
  native/              React/Vite frontend and Tauri shell for desktop and phones
packages/
  contracts/           Shared validation schemas, DTOs, error contracts
  domain/              Server-side list/task operations and permissions
  db/                  Drizzle schema, database access, migrations
  client/              Native HTTP transport, session lifecycle and refresh helpers
  ui/                  Shared browser-compatible React controls and feature screens
  design/              Shared client-safe palettes and theme derivation
docs/
```

Create packages only when they acquire real responsibilities. The retired Expo app remains available in Git history; Tauri is the sole maintained native workspace.

## Request flow and package boundaries

```text
Website / Tauri client ── HTTP API ──┐
                                    ├── Domain services ── Drizzle ── Neon
AI client / MCP App ────── MCP tools ─┘
```

- HTTP routes and MCP tools are adapters around the same domain operations.
- New persisted-data features must map each mutation to those domain/API/MCP
  surfaces and verify both write/read directions. Connection consent, scope,
  revocation, actor privacy and the MCP App UI decision are explicit parts of the
  approved feature contract. See [contributor surface requirements](guide/surfaces.md).
- The website uses the versioned API for mutations. Server rendering may call those domain services directly with the same verified user context.
- Domain services enforce permissions on every operation and receive authenticated identity from trusted server code.
- Database credentials, auth secrets, domain implementation, and database packages never enter browser or mobile bundles.
- Contracts expose stable public representations, not raw database rows.
- The HTTP client and mobile application do not import server-only packages.
- Website and Tauri share browser-compatible React controls/features from `@wuff/ui`; native storage, transport and navigation use explicit adapters. The standalone MCP App reuses public contracts/design and its own packaged interface.

## Identity and authorization

Tauri uses admitted Neon identity through system-browser PKCE, the fixed `wuff-tauri-v1` client and exact callback, and the separate `/api/mobile` token audience. Its bearer-only adapter delegates to existing domain services. The retired Expo frontend’s legacy fixed OAuth identity remains supported for compatibility; no OAuth endpoint or default shared-client behavior is removed. See [native auth](tauri-auth.md) and [shared features](tauri-features.md).

Neon Auth is the chosen identity system. Validate the current managed service capabilities before selecting an integration. Old Neon examples based on Stack Auth are not evidence for the current managed Better Auth implementation.

Website sessions, Tauri sign-in, and delegated MCP authorization need explicit integration paths. A website login cookie alone does not authorize an external MCP client.

The first technical proof must establish:

1. Invitation-only account creation is enforced at the auth boundary, not merely hidden in the UI.
2. A user can sign in and retain a valid web session.
3. An external MCP client can discover authorization, obtain consent and appropriately scoped tokens, and call a protected tool.
4. The server validates token issuer, audience, expiry, and scopes and maps identity to the correct application user.
5. A user can revoke a client connection.
6. The selected integration has a viable native authentication path; the initial native implementation is local and installed-device validation remains outstanding.

The implemented OAuth authorization layer delegates MCP access while preserving Neon identity. It uses application-owned OAuth tables and does not install upstream Better Auth plugins into the managed service.

Implemented MCP scopes are `lists:read`, `tasks:write`, `lists:manage`, and explicit `github:manage`. Existing MCP grants do not acquire the GitHub permission through refresh. Codex tool interoperability is verified; other clients and named-host inline UI remain separate checks. List membership remains authoritative even when a token has a broad write scope.

## Conceptual data model

| Entity               | Responsibility                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| User/profile         | Stable link to Neon identity and application preferences                                                                                              |
| List                 | Title, description, shared color, archived state, owner, timestamps, version                                                                          |
| List membership      | Accepted editor membership, unique per list and user                                                                                                  |
| Invitation           | Recipient user ID, list, email, expiry, acceptance and closed state                                                                                   |
| User list preference | Account-owned ordered list IDs and independent revision; current access filters reads                                                                 |
| List section         | List-bound title and shared integer position; removal preserves tasks                                                                                 |
| Task                 | List, optional parent task/section, title, Markdown content, optional calendar due date, integer sibling position, completion; version is on the list |
| Mutation receipt     | Actor, operation UUID, fingerprint, identifier result, creation time                                                                                  |

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

Work-task expansion (October 17): the [work-task plan](work-tasks-plan.md) defines the selected sequence before native clients. Stage 1 extends existing task/list contracts and domain services with Work mode, workflow/priority/assignment/references, immutable readable keys and task-detail lookup. `GET /api/v1/tasks/:id-or-key` and MCP `get_task` share the same authorized read; existing mutations carry the new optional fields. Page rendering keeps the read-only auth adapter. Live list-version invalidation also refreshes task pages; it never overrides a pending local mutation or grants access after removal. Personal views and GitHub App sync are implemented in their feature documents; agent-run contracts remain later work.

The implemented `/api/v1` interface exposes lists, members, invitations, tasks, and AI connections. See [development](development.md) for routes. Personal views and sidebar ordering use independently revisioned preferences.

An OpenAPI description remains future work; when added, generate it from shared contracts or validate it against them. Specify pagination, input limits, stable error codes, conflict responses, and idempotency behavior. Unauthorized callers must not learn private list contents through errors.

Keep reorder and membership operations explicit. Do not expose generic database mutation endpoints.

## MCP and MCP Apps

The implemented endpoint is `/api/mcp`, using stateless Streamable HTTP with delegated bearer authentication. Its tools include list/task/view/image capabilities and the eleven [GitHub tools](github-sync.md#surfaces):

- `list_lists`, `get_list`, `get_task`, `create_list`, `rename_list`, `delete_list`.
- `update_list`, `get_list_order`, `reorder_lists`.
- `create_section`, `rename_section`, `reorder_sections`, `delete_section`.
- `create_task`, `update_task`, `delete_task`, `reorder_tasks`. `get_list` includes tasks; `update_task` explicitly sets completion/reopening.
- `get_list_sharing`, `list_invitations`, `invite_to_list`, `respond_to_invitation`, `cancel_invitation`, `remove_list_member`, `leave_list`.
- Interactive `show_lists` and `show_list` tools for MCP Apps.

Tools return structured results plus concise text independently of UI support. All tool calls enforce the same authentication, permission, validation, and concurrency rules as the website. The embedded UI handles lists/tasks; sharing tools return structured data and the website provides sharing controls.

MCP App packaging must respect host sandboxing and resource policies. Do not embed secrets in UI resources. Test an agreed client matrix rather than claiming support for every AI client.

## Web and mobile offline boundary

**Current native decision:** online-only Tauri for desktop and phones. Offline persistence and queued edits remain deferred. See [client architecture](tauri-client-plan.md).

Preserve the website’s online behavior and manifest/icon identity. The push-only notification service worker adds no fetch interception or offline task storage. No offline-first PWA or disconnected mutation queue is selected. Transient in-memory snapshots, uncertain-request retries and reconnect reconciliation are online features.

The Tauri client follows the same online-only boundary. Native credential storage is scoped by server origin; snapshots and unsaved edits stay in memory. Bearer-authorized live invalidation, polling and foreground reconciliation refresh authoritative state. Sign-out clears local state and attempts remote revocation. Offline caches and queued writes need a separate privacy/revocation/conflict decision. See [authentication](tauri-auth.md) and [live refresh](tauri-live.md).

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
- [Tauri documentation](https://v2.tauri.app/)
- [shadcn/ui documentation](https://ui.shadcn.com/docs)

## Existing-account sharing

The list owner controls invitations and membership. A recipient must already have an enabled Wuff profile; managed identity alone is insufficient. Invitations reference the recipient ID and are accepted only by that actor. Legacy token hashes remain stored for schema compatibility but are not authorization credentials, are never exposed, and are not used by the in-app flow.

All sharing mutations and task writes lock the same list row and use its version. Acceptance/decline lock the list before rechecking invitation state. Cancellation and acceptance cannot both commit; a concurrent task write and revocation either serialize or fail with a stale-version conflict. Operation receipts store identifiers, and acceptance retries recheck current access instead of recreating membership. Read snapshots use repeatable-read transactions where multi-query consistency is required.

## Task notes

Tasks have canonical Markdown `content` (16,000 characters, empty by default), included in authorized snapshots. HTTP and MCP create/update adapters use the same contracts and domain mutation services, so versioning, admission, membership, archive restrictions and live invalidation apply unchanged. The website lazily loads Tiptap; the MCP App edits source with a live preview. Both share a Markdown-it renderer with HTML disabled, restricted links and non-loading image placeholders. See [task content and voice](task-content.md) for conversion safeguards, draft handling, the additive migration and the corgi copy decisions.

## One-level subtasks

Task snapshots include nullable `parentTaskId`. The same task services, routes and MCP tools enforce same-list top-level parents, independent completion, inherited sections, sibling ordering and parent deletion cascades. The existing list row lock/version and live invalidation cover children too. No new scopes or separate mobile surface are added. See [subtasks](subtasks.md) for migration, client semantics and verification.

## Calendar due dates

The task row gains nullable PostgreSQL `date` in Drizzle string mode, exposed as `dueDate: string | null`. Shared contracts validate actual `YYYY-MM-DD` dates (years 1–9999); omission preserves and explicit null clears. Existing task services, HTTP routes and MCP tools retain permissions, idempotency, list versioning and live invalidation. Parent/child dates are independent; dates do not change order or completion. Viewer-local calendar days drive Today/Tomorrow/overdue, while date strings and display never shift with time zones. See [due dates](due-dates.md) for drafts, clock refresh, migration and verification.

## Personal list nesting

[WUFF-85](personal-list-nesting.md) extends the account sidebar preference with one-level parent links and collapse state, using the same personal revision and account lock as ordering. Catalog output filters links by current access. List/task membership, snapshots and shared revisions stay independent; deleting a parent never cascades into child lists. Web/Tauri and MCP use the same domain contract.

## Personal list views

Account/list preferences use the separate `wuff_list_views` table and revision, never the shared list/task version. Shared contracts provide one pure filter/group/sort projection for web, HTTP and MCP. Authorized snapshots carry only the actor's preferences; the sealed live query includes only that actor's view revision. View writes serialize with membership changes under the existing list lock and operation receipts. Browser caches merge task and view revisions independently. See [personal views](personal-views.md) for concurrency, child context, calendar and sorting rules.

## Personal reminder delivery — October 22

See [reminders](reminders.md) for personal revisions, delayed jobs, provider adapters and privacy. Scheduled callbacks and a single daily recovery pass replace minute polling. The push-only web service worker is explicitly selected for notifications; it adds no fetch interception, offline list storage or offline writes. Native registration still requires signed installed-client proof.

## Personal list favorites

[WUFF-86](personal-list-favorites.md) adds an optional favorite list-ID set to the existing personal sidebar preference and revision. Current catalog authorization filters favorites; ordering, nesting and favorites serialize on the account row. Omitted favorite fields preserve state for older clients. No shared list/task or membership changes are involved.

## Personal Home dashboard

[WUFF-87](home-dashboard.md) adds an authorized repeatable-read cross-list projection of dated open tasks/subtasks and favorites. Calendar boundaries come from an explicit local date, never the server timezone. Bounded previews include exact totals. Independent account-owned dashboard preferences have their own version, account lock and mutation receipts; settings cannot change list membership, sidebar revisions or shared content. HTTP/native/MCP adapters use the same domain operations. A device-local account-specific last-list ID is reauthorized on startup; explicit list/task/Home URLs take precedence.
