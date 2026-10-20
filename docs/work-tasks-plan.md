# Work tasks and developer workflows

Updated: October 17, 2026

## Confirmed direction

Work is mostly personal, with occasional collaboration. Enrich the shared backend/contracts before native clients. Every shipped capability must work through the HTTP API and MCP as well as the website. Use one task model with Simple and Work list presets. The owner controls the preset; work lists can be private or shared. Preserve existing private access, invitation-only admission, list versions, idempotency and online-only website behavior.

GitHub should eventually synchronize through a real GitHub App, installation permissions, webhooks and live updates. Future developer tools should resolve a Wuff task, hand it to an explicitly authorized cloud agent, and track its GitHub work. The current milestone does not launch agents or grant repository access.

## Stage 1 — work-task foundation (implemented)

- Owner selects Work in list settings or through create/update list API/MCP; Simple remains the default. Switching back must not erase work metadata. Reject a downgrade while work-only active states, assignment, priority or references remain, so the simple view never conceals active workflow data.
- Fixed initial work statuses: Todo, In progress, In review, Blocked, Done. Status and the existing completion flag must agree. Existing checkbox/MCP clients remain supported: complete means Done; reopen means Todo. Parent and child states remain independent.
- Optional priority (none, low, medium, high, urgent), structured external references, and one optional assignee. Assign only current enabled list participants, and only on a shared work list. Removal/leaving clears now-invalid assignment in the same list transaction. Disabling a participant hides them from eligible assignees and prevents new assignment.
- Every task gets an immutable readable `WUFF-<number>` key and stable `/tasks/<uuid>` path. Numbers are globally unique, never reused and independent of list/title changes; keys are not access credentials. Task lookup accepts UUID or key and checks current list permissions. The detail page redirects through sign-in back to that exact task.
- A task page exposes work fields, title, existing notes/images, due date, completion and subtasks. It displays full names; list rows stay compact and link to details. Existing inline editing remains available.
- API/MCP return the same metadata and task detail contract. New `get_task` resolves UUID/key, current list version, task and eligible assignees. The MCP App exposes a details link and work-field controls.
- Add activity timestamps without inventing historical completion times. Backfill status from existing completion. Preserve existing IDs, content, dates, relationships, ordering and memberships.

Exit: contract/unit, live domain permission/concurrency/idempotency, authenticated API/MCP and responsive task-page tests pass on synthetic development data. Review additive Drizzle migration, apply to development before production, then deploy and smoke with disposable production data.

## Stage 2 — personal views (implemented and released)

Persist per-account/per-list filters (section, status, assignee, priority, date), grouping (section/status/date), sort (manual/priority/due/updated), compact/detailed layout and collapsed groups. All preferences have API/MCP operations, a revision and operation ID. Owner-defined defaults may be added explicitly; changes to a personal view never alter another member's view or the shared manual order.

Keep subtasks attached to their parent; define filter matches on children and expose why a parent appears. Missing dates sort last, ties are deterministic. Per-section sort overrides apply only when grouping by section. Disable task dragging under computed sort; filtered manual reordering must preserve hidden positions. Archived/completed visibility stays explicit. Search includes key/title. Add optional planned dates only after distinguishing planned work from existing due dates; do not reinterpret old dates. Tags, recurrence, dependencies, boards and cross-list views remain separate follow-ups.

## Stage 3 — GitHub App and real synchronization (implemented)

The [delivery plan](github-sync-plan.md) records the delivery slices; [implementation and verification](github-sync.md) record the final decisions and evidence. The design/theme/typography release is delivered separately; agent execution remains Stage 4.

1. Register a GitHub App and install on a disposable repository before production rollout. Bind installation/repository access to an authorized Wuff owner. Start with metadata read, issues read/write, pull requests read; request additional permissions only when a concrete feature needs them. Keep app keys, webhook secret and short-lived installation tokens server-only. Revocation/uninstallation stops synchronization and clears access.
2. Explicitly link an existing issue or create one from a Wuff task; no automatic import of all repository issues. One primary issue per task; additional PRs/issues remain references. Record provider IDs, repository IDs and node IDs rather than relying on mutable URLs.
3. For the first sync contract, title and notes are two-way; issue open/closed maps to Todo/Done. Wuff's intermediate states remain Wuff-owned unless an explicit GitHub Projects mapping is later selected. Assignees synchronize only through verified identity mappings to eligible Wuff participants. Do not infer that matching names establish identity. Keep private repository content within the installation owner and explicitly permitted list audience.
4. Validate HMAC on raw webhook bytes, enforce payload bounds, deduplicate deliveries and store durable pending events before acknowledging. Process asynchronously with bounded retry/backoff and visible failed/conflict states; do not assume GitHub retries failed delivery automatically. Re-read authoritative provider state to handle delayed/out-of-order events. Use durable outgoing operations for Wuff-to-GitHub changes, an origin marker and last-synced values to avoid echo loops. Concurrent divergent edits become visible conflicts, not silent last-write-wins.
5. Reconcile missed deliveries/rate limits and reflect committed changes through the existing authorized live-update path. Distinguish GitHub unavailable from deleted/unlinked resources. PR/check/review signals are context first; merge-to-Done automation requires a task-specific rule and must account for multiple PRs.

Exit: signed webhook tests, duplicates/reordering, issue creation/link/edit/close/reopen in both directions, permissions/revocation, retries/conflicts, API/MCP parity and actual installed-app delivery on a disposable repository. A mock webhook is not live GitHub integration proof.

Research: GitHub's [webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks), [signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) and [App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

## Stage 4 — developer-agent handoff (resumed October 20)

The user resumed provider research and then explicitly authorized implementation on October 20, including PR tracking, Cursor environment secrets, ongoing ticket conversations and MCP controls. See [implementation and release gates](cursor-agents.md). The earlier October 17 deferral is superseded for this work. Native push notifications remain deferred.

Build a provider-neutral task execution contract: task/version, authorized repository and base ref, acceptance criteria, run identity, status, logs/artifact references and PR links. Model runs separately from task workflow status; a failed run need not mark the task Done or Blocked automatically. Require explicit launch authorization, scoped repository credentials, retry-safe creation, cancellation and cost/runtime limits. Research the selected provider's supported cloud-agent API at implementation time. Keep task content as untrusted work input rather than permission to execute tools or reveal secrets. Keep merges/deployments as separate authorized operations.

## Delivery state

Stage 1 is implemented; release verification follows below. Stage 2 personal views are implemented and released; see [personal views](personal-views.md). Stage 3 GitHub synchronization is implemented and released within its documented scope; Stage 4 is deferred by user decision. The user subsequently selected online-only React Native/Expo mobile; the initial local slice and next delivery gate are recorded in [native mobile](native-mobile.md).

## Stage 1 development verification

- `pnpm check` passed with 29 unit tests, workspace/root TypeScript and optimized web/MCP builds. All 20 live integration tests passed in one serial run against the isolated development branch (209.6 seconds). The final targeted work-task integration test passed again after normalizing private/missing task lookup errors to the same response.
- Tests cover Work/Simple boundaries, fixed workflow/completion agreement, immutable keys and non-reuse, references validation, assignment eligibility and removal/leaving cleanup, scoped writes, owner controls, archive restrictions, stale/concurrent updates, safe retries and permission rechecks on receipt replay. A redundant `completed=false` preserves an already-open work status; an actual Done-to-open transition returns to Todo. Raw legacy checkbox updates exercised the migration trigger.
- The expanded authenticated OAuth test creates a work task through HTTP, reads it by key through MCP `get_task`, verifies the same references/priority through HTTP, opens its server-rendered task page, checks sign-in return redirection and completes through MCP with HTTP confirmation. Existing auth/OAuth, sharing, notes, subtasks, image and live-update tests also passed. These are real protocol checks, not named ChatGPT host certification.
- A real synthetic browser on the optimized runtime converted a disposable list to Work, followed a title link to its task page, saved status/priority/reference, shared it with another synthetic account, assigned the task, and saved a title, note, Tomorrow date and child task. An incoming completion preserved the open work draft; attempting its stale save returned a conflict, and explicitly loading latest details allowed a new save. Escape cancelled and restored focus. A small follow-up fixed initial subtask autofocus on detail pages and cleared prior success feedback during new writes.
- The official MCP Apps SDK host exposed the same Work fields and eligible assignees. Saving Blocked/Urgent there updated the open website through live invalidation. A separate authorized domain read verified exact title, note, due date, reference, status, priority, assignee and child relationship. The SDK host generated localhost task links from the configured server origin.
- At 320, 390 and 1280px, task-page document width matched viewport width. The 320px work inputs/selects measured 44px high with 16px text. Physical iOS/Android keyboards, VoiceOver/TalkBack and installed native apps were not tested. [390px synthetic task page](screenshots/work-tasks-mobile.png).
- A static scan of 22 browser scripts found no server secret variable names, advisory-lock SQL or task SQL. The migration was applied only to the existing isolated development branch before production. No auth-managed tables, dependencies or environment secrets changed. Browser viewport overrides were reset and review tabs closed; the documented fixture shutdown cleans its disposable list and OAuth grant.

## Stage 1 production release

Source `9ad0fe1596277707834af4810ce3700aef97b6a2` passed [GitHub CI 39011559856](https://github.com/timbenniks/wuff-todo/actions/runs/39011559856). Migration `0007_red_kronos` was applied through Drizzle using the existing production direct connection. Before/after hashes of existing list/task fields and membership pairs matched; 2 lists, 13 tasks and 1 membership were preserved. All 13 existing tasks received distinct keys, with zero status/completion mismatches. Historical completion dates remain unknown/null.

Vercel CLI deployment `dpl_EXHiYzkMnsKSdZDYA93MD77cxDJj` completed READY. The connected Git deployment subsequently held the canonical production alias as `dpl_AhZtjiYbY58KfUcTo2MPSWyGtgTY`; inspection of that alias confirmed READY and actual function region `fra1`.

The existing signed-in production browser created a disposable private list, changed its preset to Work, created a task and followed its title link to the detail page. In review, High priority and a named external reference saved successfully. Opening the same task by `WUFF-14` loaded those persisted values. The page had no autofocus jump; document width equalled the 390px viewport. [Production task-page screenshot](screenshots/work-tasks-production.png) contains only synthetic content.

A separate authorized domain read verified exact mode, key, status, priority, reference and null private-list assignment. The disposable list was then deleted and its task confirmed inaccessible. Production returned to 2 lists, 13 tasks and 1 membership; no real task or membership was edited. Development fixture deletion was independently confirmed by a 404 task lookup, and the temporary local server was stopped. Browser tabs were closed and viewport overrides reset.

Anonymous task/list API and MCP checks returned 401; task links redirect through sign-in with the task return path. Authenticated production MCP calls, a named-host interactive UI and second-human production assignment were not repeated in this release; the authenticated API/MCP, shared-assignment and SDK-host evidence above is from isolated development. At that Stage 1 release, personal views were still upcoming; Stage 2 is now implemented and released. That historical release predates Stage 3; current GitHub release evidence is in [GitHub sync](github-sync.md). Planned dates and cloud-agent execution remain follow-ups.
