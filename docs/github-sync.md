# GitHub issue synchronization

October 17, 2026. Implemented; final installed-App webhook and production release checks are being completed in this change.

## Ownership and consent

The private `@timbenniks` App `wuff-todo` (5355720) is installed only on `timbenniks/wuff-github-sync-test` for release verification. It requests Issues read/write, Pull requests read and mandatory Metadata read. No code, Actions, repository administration, merge or agent execution permission is requested. Organizations and assignee identity mapping remain later work.

A signed-in admitted Wuff owner connects their GitHub identity with one-time, ten-minute, account-bound state and S256 PKCE. GitHub App access/refresh credentials are encrypted at rest with the environment's server-only token secret. The callback consumes state before exchange; an installation ID supplied in a setup URL is never accepted as ownership proof. Only repositories administered by the verified GitHub identity in that identity's own personal installation are offered. Bindings require explicit consent to expose supported issue content to the list's current and future members.

The documented expiring GitHub App user-token flow is supported directly: it uses the intersection of user/App access and rechecks the installation/repository before every reconciliation. Optional App signing-key configuration uses repository-scoped short-lived installation tokens instead. GitHub registered one signing key, but Chrome blocked its one-time download; no signing key was stored/configured by this workflow. The deployed path uses encrypted, expiring user tokens and refreshes them server-side. No credential values belong in source, task notes or logs.

Web sessions have the supported application scopes. External MCP clients need explicit `github:manage` consent for repository enumeration or external writes; existing list/task scopes do not gain it through refresh. Editing synchronized title, notes or completion also requires that permission, so an old AI client cannot trigger new GitHub writes implicitly. Issue-link state is readable under current list access. Owners bind/disconnect/link/unlink; authorized task editors may reconcile and resolve conflicts. Archived/Simple lists do not synchronize.

## Behavior

- Connect a repository at `/github`; explicitly link an existing issue or create one from a task's supported title/notes. There is one primary issue per task and one Wuff link per repository/issue. Provider IDs are stable; repository names are reread by ID to handle renames.
- New issue creation uses a durable operation and a hidden correlation marker. A lost create response triggers marker-based recovery, never a blind second POST. If recovery cannot establish the outcome, the state stays visibly failed/uncertain. The user must investigate before intentionally creating another issue.
- An existing link with different starting values presents both candidates for an explicit initial choice. Thereafter title, supported Markdown notes and open/closed state use field-level comparison against last-synced values. Independent edits merge; divergent edits expose a conflict with versioned Keep Wuff / Keep GitHub actions. A stale resolution is rejected.
- GitHub closed maps to Done; reopen maps to Todo. Wuff intermediate states remain Wuff-owned while the issue stays open. Priority, due dates, assignments and subtasks are not synchronized. Parents and children retain independent completion.
- No automatic binary attachment export. HTML, private attachment references, data/blob references, empty titles and content beyond Wuff's supported bounds fail before outbound content transmission. Existing private assets remain private. Assignee matching is never inferred from names.
- Related PR context comes from the authorized issue timeline, restricted to the same repository. Merge signals do not automatically complete a task.
- Unlink leaves both resources intact. Wuff disconnect, disabled ownership, archive, installation suspension/deletion or repository removal stop further work. Existing copied task content remains in its Wuff audience; disconnection is not a content-erasure feature. Reconnecting the same verified repository restores existing links.

## Durable processing and concurrency

Migration `0009_rainy_red_wolf.sql` adds only application-owned GitHub accounts, authorization states, bindings, links, delivery receipts and jobs. A task-update trigger atomically enqueues relevant changes from any adapter; it does not alter old task content. Other fields produce no outbound job. Jobs coalesce by task, carry a generation and a reclaimable 90-second lease, and use a per-task advisory lock. Unlink/resolve operations serialize with reconciliation. Writes arriving during processing retain another generation rather than disappearing with an old job acknowledgement.

Webhook bytes are bounded to 256 KiB, HMAC verified before parsing, and persisted/deduplicated by delivery identity plus digest before acknowledgement. Selected installation revocations and issue invalidations are committed transactionally; processing rereads current provider state instead of trusting delayed payload content. Delivery receipts are retained 30 days. Replayed stale deliveries still reconcile authoritative state.

Next.js `after` wakes the durable queue under the platform's managed request lifetime; jobs survive interruption and lease expiry. Batches have a 45-second budget plus bounded provider timeouts and process at most eight jobs. Failures back off and stop automatic retries after eight attempts; explicit Reconcile resets the retry budget. A daily authenticated Vercel cron (`47 3 * * *`, UTC) enqueues missed-state reconciliation without resetting existing retry schedules. This accommodates the existing project's daily cron plan; it is not a promise of minute-level missed-event recovery under an idle or overloaded queue. Actual incoming events and task writes wake processing promptly. CRON_SECRET is server-only.

Last-synced comparisons, a second provider read before PATCH and provider conditional headers reduce races. GitHub external writes are not part of a database transaction; exact provider-side compare-and-swap support must not be claimed without verifying its behavior. Divergence observed by Wuff is surfaced rather than resolved by an intentional last-write-wins policy.

## Surfaces

`GET /api/v1/github` reads connection status, installed repositories, a selected list binding, task state or related PRs. `POST` accepts an explicit action: connect, bind, disconnect, link, unlink, retry or resolve. Mutations use same-origin web auth, current list versions and actor-scoped operation UUIDs. Receipts are replay-safe and current access is checked again. `/api/github/callback` handles GitHub authorization; `/api/github/webhook` receives signed deliveries; `/api/internal/github` is bearer-CRON_SECRET protected.

MCP adds eleven tools (41 total): `get_github_connections`, `list_github_repositories`, `get_github_list`, `get_github_task`, `get_github_pull_requests`, `bind_github_repository`, `disconnect_github_repository`, `link_github_issue`, `unlink_github_issue`, `retry_github_sync`, `resolve_github_conflict`. The embedded task details provide linking, create, status, reconcile, conflict choices, unlink and PR-context controls; connection setup follows the authenticated website link, matching the existing sharing setup pattern. Web task pages expose the same operations. Refresh the MCP tool catalog and reconnect for GitHub permission when needed.

## Evidence so far

- Full optimized web/MCP build, workspace/root typechecks and all 39 unit tests passed. All 22 isolated-development integration tests passed. The added GitHub integration uses a real isolated database and a mocked provider; it verifies account-bound one-time authorization, repository ownership, scope boundaries, mutation retries, signed/duplicate deliveries, two-way state, stale/conflicting writes, uncertain-create recovery and disconnect handling. It is not live installed-App proof by itself.
- A separate real installed-App test on the private disposable repository created issue #1, synchronized title/notes in both directions, closed/reopened into Done/Todo, exposed/resolved divergent titles and passed Wuff disconnect/rebind recovery. A synthetic PR was created and returned by the authorized PR-context reader. Fixture content was synthetic; no real code repository was granted to the App. See `scripts/verify-github-development.ts` for the guarded development check.
- The additive migration was applied first to isolated development, then through the existing production direct connection. Before/after hashes of existing list, task and membership rows matched (2 lists, 19 tasks, 1 membership). No auth-managed table or existing row content was changed by migration.
- The separate production visual smoke saved all seven themes, restored Slate, verified Detailed/Compact saves across reloads, restored Compact, and saved/reloaded rendered italic notes. The corresponding Wuff task is Done with explicit named-host/device limits. No temporary production list was needed.

Production webhook, final release, responsive SDK-host evidence and cleanup are recorded below after completion. A named ChatGPT/Codex interactive host and physical iPhone/Android checks remain separate from local SDK/browser verification.
