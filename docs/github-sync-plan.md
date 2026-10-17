# Next milestone: GitHub synchronization

Date: October 17, 2026

Status: implementation plan, not an implemented integration. This elaborates the confirmed Stage 3 direction in [work tasks](work-tasks-plan.md). No GitHub App registration, installation, repository mutation, migration or agent launch was performed in this planning pass.

## Outcome

From a Work task, explicitly link an existing GitHub issue or create one. Keep its title, supported note content and open/closed state synchronized in both directions, with visible pending, failed and conflict states. A GitHub change should appear in an open Wuff list through its existing authorized live-refresh path. Web, HTTP API and MCP expose the same permitted operations and sync state.

Example: link WUFF-15 to a selected repository issue. Closing the issue marks the task Done; reopening returns it to Todo. In progress, In review and Blocked remain Wuff-owned. A concurrent divergent title or note edit requires a visible resolution rather than overwriting either side. PR references provide context; merging does not automatically complete a task.

## Entry gate: finish the visual release check

The shared design, palettes, DM Sans and dropdown/spacing fixes are pushed and passed CI. The production alias is Ready in Frankfurt; fresh authenticated production interaction is still a separate gate. Check a signed-in list and task, list palette changes, view Apply/reload, notes italics and dropdown spacing. Use synthetic data and remove it afterward. Exercise a named MCP interactive host when the connection is available. Physical iPhone/Android checks remain a distinct follow-up before native implementation; browser viewport checks do not substitute for them.

## Delivery slices

| Slice                                   | Deliverable                                                                                                                                                                                                                                                         | Exit evidence                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3A: connection and ownership            | Register/install a real GitHub App on a disposable repository. Bind a verified installation and allowed repositories to an admitted Wuff owner. Show connection/revocation state.                                                                                   | Installation and callback ownership tests, rejected cross-account attachment, repository removal/uninstall and real installed-App read. No issue mutation yet.                                                   |
| 3B: explicit linking and durable events | Domain/contracts/schema for installation bindings, task/issue identity, last-synced values, incoming deliveries and outgoing operations. Link/read/unlink through web/API/MCP. Verify webhook bytes, persist before acknowledgement and process with bounded retry. | One primary issue per task, stable provider IDs, admission/list/installation checks, duplicate/out-of-order delivery tests and actual signed GitHub delivery.                                                    |
| 3C: create and synchronize              | Explicit issue creation and two-way title/notes/open-state synchronization; origin/baseline checks, conflict resolution, retry and reconciliation UI/tools. Feed committed changes into existing live invalidation.                                                 | Create/edit/close/reopen from both sides, uncertain-create recovery without duplicate issues, divergent edits, failed retries, missed deliveries/rate limiting, retained drafts and fresh provider/domain reads. |
| 3D: release and context                 | PR reference/context reads where authorized; operational recovery and token revocation checks; responsive/SDK-host review. Apply reviewed additive migration to the existing Vercel-managed Neon branches in sequence.                                              | Full permission/concurrency/idempotency regression suite, private/shared audience tests, real installed-App disposable-repository smoke and documented production cleanup.                                       |

Each slice must leave a coherent, reviewable state. Connection-only or link-only delivery must not be described as completed two-way synchronization. Keep the selected design language for setup buttons, sync tags, errors and retry actions.

## Decisions to settle during 3A design

These are implementation decisions still to resolve, not reasons to start building unrelated features:

- **Installation proof and owner binding:** define the verified GitHub identity/callback flow and who can connect, unlink and retry. Recommended starting policy: owners bind repositories to their Work lists; task editors can operate only within explicitly granted bindings. An installation ID or URL alone is not proof of ownership.
- **Audience boundary:** linking a private issue to a shared list exposes supported issue content to that list's members. Define explicit owner consent and what happens on member changes, repository removal and revoked GitHub access. Do not fetch private data before the current Wuff and installation checks pass.
- **Notes and attachments:** define supported Markdown conversion and content limits. Wuff's private attachment references must never become public GitHub URLs or unusable internal paths. Recommended first contract: no automatic binary attachment export; surface unsupported content before creating/enabling synchronization, preserving existing private assets.
- **Durable execution:** choose the smallest supported queue/worker and reconciliation mechanism compatible with the existing Vercel deployment. Persist pending work before acknowledgement; do not rely on unawaited work after a request ends. Record scheduling/runtime constraints before choosing infrastructure.
- **Conflict UX:** specify field-level baseline comparison, stale-resolution checks and explicit Keep Wuff / Keep GitHub actions. Model sync status separately from task workflow. Do not imply eventual success while a write is unresolved.

Assignee sync requires a verified identity mapping to currently eligible list participants. It may only ship once that proof exists; names/emails guessed from content are insufficient. Planned dates, GitHub Projects mappings and additional workflow automation remain separate decisions.

## Contracts and invariants

- Reuse admitted actors and shared server-side domain services. Installation permissions never substitute for Wuff list access. Tokens, app keys and webhook secrets stay server-only in ignored/configured environment stores.
- Preserve list versions, idempotent operation identities and view revisions. External work uses durable receipt/state boundaries; provider calls are not part of a long-held database transaction.
- Treat webhook payloads and issue content as untrusted data. Validate signatures on bounded raw bytes, deduplicate delivery IDs and reconcile authoritative provider state. An issue body cannot authorize an agent, a repository change or a secret read.
- Unlink/revocation stops future reads/writes. Define the safe handling of already copied content and pending operations explicitly; avoid silent deletion of Wuff tasks or GitHub issues.
- First scope is explicit issue linking, not repository-wide import. No repository creation, code writes, agent execution, merge, deployment automation, recurrence or notifications are added by this milestone.

## First implementation handoff

Start with 3A ownership/auth design and 3B contract/schema sketch, including migration and failure-state examples. Confirm the app registration owner, disposable test repository and required GitHub permissions using the actual endpoints before registering/installing. Implement against the existing isolated development branch; do not create a replacement Neon project. Add focused ownership/revocation tests before connecting real data. No product database migration is required merely to approve this plan.

## Research checked October 17

GitHub recommends minimum permissions, narrowly subscribed events, secret-validated deliveries, prompt acknowledgement and recovery for missed deliveries. Its delivery ID is reused on redelivery, so persistence must distinguish received, processed and retryable work rather than discarding all repeated IDs blindly. See [webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks) and [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app). Recheck exact endpoint permission requirements and token APIs during implementation.
