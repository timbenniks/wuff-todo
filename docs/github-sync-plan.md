# GitHub synchronization delivery plan

Date: October 17, 2026

Status: slices 3A–3D implemented, deployed and verified within the limits in [implementation and evidence](github-sync.md). This document preserves the original delivery gates and decisions; the implementation document is authoritative for the selected design.

## Registration and release — October 17

The approved private `@timbenniks` App `wuff-todo` (5355720) is configured and installed only on `timbenniks/wuff-github-sync-test`. It has Issues read/write, Pull requests read and Metadata read, exact callbacks, encrypted expiring user tokens, signed issue/lifecycle deliveries and server-only secrets. Production OAuth, issue creation, two-way edits, close/reopen, signed webhook delivery and suspension/reconnection passed. Temporary production task links were removed and the Work list sandbox binding stopped after verification. See [release evidence](github-sync.md).

## Outcome

From a Work task, explicitly link an existing GitHub issue or create one. Keep its title, supported note content and open/closed state synchronized in both directions, with visible pending, failed and conflict states. A GitHub change should appear in an open Wuff list through its existing authorized live-refresh path. Web, HTTP API and MCP expose the same permitted operations and sync state.

Example: link WUFF-15 to a selected repository issue. Closing the issue marks the task Done; reopening returns it to Todo. In progress, In review and Blocked remain Wuff-owned. A concurrent divergent title or note edit requires a visible resolution rather than overwriting either side. PR references provide context; merging does not automatically complete a task.

## Entry gate: finish the visual release check

The production design gate passed: signed-in list/task, all seven palette saves with Slate restored, Detailed/Compact save/reload with Compact restored, rendered italic notes and the corrected view controls. Named MCP interactive-host and physical iPhone/Android validation remain separate; the local official SDK host was exercised for GitHub controls.

## Delivery slices

| Slice                                   | Deliverable                                                                                                                                                                                                                                                         | Exit evidence                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3A: connection and ownership            | Register/install a real GitHub App on a disposable repository. Bind a verified installation and allowed repositories to an admitted Wuff owner. Show connection/revocation state.                                                                                   | Installation and callback ownership tests, rejected cross-account attachment, repository removal/uninstall and real installed-App read. No issue mutation yet.                                                   |
| 3B: explicit linking and durable events | Domain/contracts/schema for installation bindings, task/issue identity, last-synced values, incoming deliveries and outgoing operations. Link/read/unlink through web/API/MCP. Verify webhook bytes, persist before acknowledgement and process with bounded retry. | One primary issue per task, stable provider IDs, admission/list/installation checks, duplicate/out-of-order delivery tests and actual signed GitHub delivery.                                                    |
| 3C: create and synchronize              | Explicit issue creation and two-way title/notes/open-state synchronization; origin/baseline checks, conflict resolution, retry and reconciliation UI/tools. Feed committed changes into existing live invalidation.                                                 | Create/edit/close/reopen from both sides, uncertain-create recovery without duplicate issues, divergent edits, failed retries, missed deliveries/rate limiting, retained drafts and fresh provider/domain reads. |
| 3D: release and context                 | PR reference/context reads where authorized; operational recovery and token revocation checks; responsive/SDK-host review. Apply reviewed additive migration to the existing Vercel-managed Neon branches in sequence.                                              | Full permission/concurrency/idempotency regression suite, private/shared audience tests, real installed-App disposable-repository smoke and documented production cleanup.                                       |

Each slice must leave a coherent, reviewable state. Connection-only or link-only delivery must not be described as completed two-way synchronization. Keep the selected design language for setup buttons, sync tags, errors and retry actions.

## Original 3A design questions (resolved in implementation)

The selected policies are documented in [GitHub sync](github-sync.md); the original design prompts are retained below for context:

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

## Handoff

Preserve the existing installed App, additive migration and owner/audience boundaries. Do not rerun registration or migrations on a new chat without inspecting current state. Reconnect external MCP clients with explicit `github:manage` consent to use the eleven new tools. Next work is Stage 4 planning; agent execution is outside this release.

## Research checked October 17

GitHub recommends minimum permissions, narrowly subscribed events, secret-validated deliveries, prompt acknowledgement and recovery for missed deliveries. Its delivery ID is reused on redelivery, so persistence must distinguish received, processed and retryable work rather than discarding all repeated IDs blindly. See [webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks) and [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app). Recheck exact endpoint permission requirements and token APIs during implementation.
