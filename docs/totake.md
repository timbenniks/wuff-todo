# Wuff Totake integration

October 25, 2026. Implemented on draft PR #26; verification and release gates below. Source of product behavior: Joreel’s local `wuff-to-take-handover-2026-10-25/BLUEPRINT.html`, sections 2–19. No personal screenshots, conversation exports or medication data are copied into the repository.

## Brief and acceptance

Build the approved Totake experience inside Empire using the current contributor skill and root/web AGENTS.md. Preserve invite-only accounts, Todo behavior, standalone Settings, explicit saves and online-only recovery. Private medicine data belongs only to its account; Todo membership and old OAuth grants convey no medicine access.

- [x] Personal treatments, schedule revisions/exceptions, stable occurrences, immutable records/audit and count-only stock ledger. Atomic record/stock/Undo with retry IDs and concurrent-write protection.
- [x] Daily/week/month overview, grouped selection/Taken/Done/Skip/Snooze, recorded history/Undo, setup/edit, as-needed entries, stock warnings/adjustments. Preserve DD-MM-YYYY, 24-hour time, current Wuff controls, responsive sidebar and keyboard recovery.
- [x] Dedicated Totake read/write consent; complete shared-domain HTTP/MCP/native capabilities, explicit browser handoffs and actual adapter parity.
- [x] Global and per-app notification pause/status/device controls with callback enforcement and no repeat backlog on resume. Todo keeps its delivery rules; Totake has no silent missed completion, expiry or inherited quiet-hour delay.
- [x] Durable scheduling/current-state checks; secure actions cannot double-record or deduct; provider acceptance is distinct from user acknowledgement.
- [x] Meaningful unit coverage, isolated integration, OAuth/revocation, browser 320/390/1280 and actual MCP controls. Real installed phone/watch delivery remains a release gate.

## Delivery and review

Additive Drizzle migration in the existing database, dedicated app-owned tables, no auth-managed changes. New scopes are opt-in and refresh cannot expand grants. Reuse current notification devices/transports/QStash instead of provisioning another service. Preparing code is authorized; migration execution, production configuration and release require explicit operational authorization. The prior migration 0018 authorization does not authorize new migrations. No preview writes before backend isolation is confirmed.

Do not import demo clocks, sample treatments, localStorage persistence or old shared-package snapshots. Liquid/drop medication supports schedules and records but no inventory. Units are inherited counted units; no conversion or dose advice. Cycles retain the handover’s explicit proposal acceptance and documented rare travel limits. Exact Android/watch/full-screen interactions require demonstrated platform support and review of any alternative.

## Verification plan

Unit tests: calendar/scheduling DST, occurrence identities and exceptions; selection/records/Undo/PRN; stock counts/exclusions/fractions; repeat/snooze and pause/resume; contract validation and exact retry recovery. Integration: two synthetic accounts, actual HTTP/MCP/native reads and writes, scope/consent/revocation, transactions, duplicate/concurrent operations, stale callbacks and provider-mocked delivery. UI: complete drafts/cancel, conflicts, lost committed response, reload and cross-client updates, narrow layout/focus.

## Data and transaction contract

Ten additive app-owned tables: notification preferences; Totake accounts (revision, zone/planner state); treatments; immutable schedule revisions; expected occurrence groups; immutable record snapshots with an Undo marker; audit; exact stock movements; next account scheduler job; per-device/group delivery receipts. Structured recurrence/exception payloads are typed JSON, rather than a separate SQL column for every schedule variant. Existing Wuff users remain the owner boundary. Composite account/entity keys prevent collisions across accounts.

The domain takes one account advisory lock, verifies admission/scopes before receipt replay, compares the independent Totake version, applies an explicit validated action and commits treatments/occurrences/records/audit/stock/job/receipt together. Records include immutable item snapshots. Undo appends a reversal and never deletes its original record. Count movements retain exact decimal strings and use scaled BigInt internally; BigInt never enters JSON. Quantities support up to twelve decimal places, including fractional tablets, without strength/package/liquid conversions. The prototype’s decimal-number arithmetic has been strengthened for persistence.

The shared pure engine is adapted from the handover, with demo data, manual clock and browser persistence removed. Dates use epoch-day indices from 1970, with DD-MM-YYYY/24-hour presentation. The server supplies the clock. Unlike a manual simulation, timezone changes do not fabricate sent alerts or advance their deadlines. Snooze is available only once the selected reminder is due; moving a future reminder uses the explicit scoped date/time editor. Fixed schedules use named local zones; elapsed-hour schedules use UTC intervals; folds/gaps and explicit one/future scopes retain the handover’s policies. Sensors mean insertion of exactly one, without activation reminders or automatic re-anchoring. PRN records create no expected dose. Default repeat changes affect future unstarted groups, not active cadence. Failed refreshes retain drafts and disable writes until an authoritative read succeeds; version/generation checks prevent an old read replacing an acknowledged save.

The planner normally materializes 31 days, extending for explicitly viewed future dates up to one year. Already-due/recorded snapshots remain protected. Reads currently reconstruct the person’s aggregate from its normalized tables; the summary returns at most five groups and no medicine names. This initial personal-account implementation does not yet provide paginated historical export or a measured large-history performance guarantee. Review that scaling boundary before expanding beyond the family deployment. Scheduled writes update only changed rows; audit, stock and original record bodies are append-only.

## Surfaces and consent

| Action                                                                          | Shared domain                                        | HTTP / native                                      | MCP                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Read personal data                                                              | getTotake                                            | GET /api/v1/totake, getTotake                      | get_totake / show_totake                                 |
| Read bounded counts                                                             | getTotakeSummary                                     | GET /api/v1/totake/summary, getTotakeSummary       | get_totake_summary                                       |
| Save treatment, record/skip/snooze/Undo, PRN, stock, scoped time or preferences | updateTotake                                         | PUT /api/v1/totake, updateTotake                   | update_totake                                            |
| Read/save delivery pauses and privacy                                           | getNotificationSettings / updateNotificationSettings | GET/PUT /api/v1/notifications, same native actions | get_notification_settings / update_notification_settings |

`updateTotake` uses a strict discriminated `change.action`, current version and operationId. Every client can perform each action; mutations cannot submit a whole replacement state or impersonate another account. New scopes are `totake:read`, `totake:write`, `notifications:read` and `notifications:manage`. Existing Todo defaults/refreshes are unchanged. Totake-only MCP consent is supported. Native optional scopes are additive; its current basic Todo grant remains unchanged. The native bearer adapter/client/route mapping are prepared, but the installed native workspace remains Todo; installed Totake navigation and push integration require the native release work below.

MCP App UI implements bounded grouped selection, recording, Skip, Snooze and Undo. Complex setup, inventory editing, calendar navigation and global device configuration use the website handoff plus complete structured tools. No fake device registration or inline OS permission control is rendered in an AI host. Medical actions require explicit user intent; tools do not infer doses or advise medication changes. New tool metadata requires refreshing existing clients’ catalogues and explicit reconsent for data access.

## Shared notification semantics and release gates

Global `paused` and per-app `apps.todo`/`apps.totake` are pause flags; `true` means paused. They do not change a schedule, record or stock balance. Callbacks reread policy under the same personal notification lock as device/settings changes. Pause invalidates queued job generations. Todo resumes its next daily time or one current nonexpired task reminder; expired task sends remain discarded. Totake resumes one current alert per unresolved group, then continues its cadence, without replaying each elapsed repeat. Todo quiet hours/24-hour task expiry are never applied to Totake.

QStash carries only a job UUID and generation. Six-day planning wakes cover longer dates. Jobs stay pending until a configured device exists; device registration retries pending publication. Daily recovery also re-arms overdue scheduled jobs after exhausted provider retries. Current authoritative state controls payloads; per-device/group receipts commit separately so later provider failure does not discard accepted sends. A provider acceptance followed by a crash before receipt commit can still duplicate a displayed notification; delivery is at least once, while recording/stock mutations are idempotent. Stale actions open the authorized current reminder and cannot restore a completed record. The current transport payload opens Totake; OS-native checkbox/record actions are not claimed implemented.

`WUFF_TOTAKE_DELIVERY_ENABLED` defaults off and is not enabled in production by this PR. The UI reports delivery unavailable while off. Existing Todo transports/devices are reused; provider keys/OS permission/signed registration/actual delivery remain distinct. Default Totake payloads contain no medicine names. Existing Todo title privacy remains effective; explicit shared privacy saves additionally control payload content.

Migration 0019 was explicitly authorized by Tim for development and production. Applied to isolated development first, then production: all ten new tables read back; production user/list/task/member counts and complete row fingerprints unchanged. No auth-managed table or production user data was modified. This schema preparation did not deploy the application or enable delivery.

Release gates: native Totake navigation and explicit optional-scope consent; native push registration/token lifecycle/actions; real Web Push/APNs/FCM/WNS configuration and delivery; closed/restarted phone, stale/duplicate/background and both-watch proof. Exact platform interaction alternatives need review where the desired checkbox/full-screen behavior is unavailable. Keep the existing reminder arrangement until fictional parallel tests prove the replacement. Read-only Vercel environment-name inventory confirmed production lacks Web Push and native transport credentials and the Totake enable flag. No provider was provisioned or configured. No actual Galaxy Watch 7, Garmin Venu 3 or named production AI-host support is inferred from browser/SDK checks.

## Verification

Current evidence is recorded in docs/verification.md and the PR. Core integration tests and optimized browser checks use synthetic development data; callbacks use mocked senders and publish no real messages. Screenshots under docs/screenshots/totake-* contain fictional examples only. Required checks that are blocked/unrun keep the PR a draft.

## Web notification action follow-up — October 25

[Draft PR #35](https://github.com/timbenniks/wuff-todo/pull/35) adds guarded
single-item Taken/Done and Snooze 15 min, with the existing checklist for grouped
selection, Skip, all four snooze durations, Undo and scoped time changes. It fixes
calendar/DST occurrence links and account/expired-login handoff. Exact policy,
contract, current tests and remaining real-device/release gates are recorded in
[notification actions](totake-notification-actions.md). Earlier lack-of-Web-Push-key
inventory above is historical: VAPID was subsequently configured in the separately
authorized setup recorded in [web notifications](web-notifications.md). Totake's
production delivery gate remains separate; this branch does not enable it.

## Production delivery activation — October 26

Read-only investigation on deployed main `5cda72369a68e191067715fcd17f81023b072f40`
found Web Push and QStash configured, but `WUFF_TOTAKE_DELIVERY_ENABLED` absent.
Both Totake publication and callbacks return early without that flag. One enabled
job was pending and no Totake delivery receipts existed; global/app pauses were
off. Todo's working transport did not imply Totake activation.

Tim explicitly authorized enabling the Production flag, redeploying the same main
commit, and publishing the pending job. Activation can alert for an existing
unresolved occurrence and repeat on its saved cadence. No medicine was marked
Taken/Skipped, no intake/stock data was edited, and no schema migration is needed.
The existing account/privacy, pause, current-state, consent and delivery gates
remain in force. Vercel CLI added the flag to the existing project only.

Fresh isolated verification against that exact main commit:
- `node --import tsx --test tests/totake.test.ts tests/totake-notification-actions.test.ts tests/scheduler.test.ts`: 38 unit tests passed, no skips.
- `node --env-file=<isolated-development-env> --import tsx --test --test-name-pattern='Totake callbacks' tests/totake.integration.test.ts`: one real-database callback case passed, no skips; pause, per-device partial failure/retry, stale generation, repeat scheduling, recorded-item cancellation, stock and recovery.
- `node --env-file=<isolated-development-env> --import tsx --test tests/scheduler-publishing.integration.test.ts`: one real-database publisher case passed, no skips; deterministic provider-compatible IDs, rejected/uncertain publication, six-day hops, account scope, pause and Totake gate.

These tests use synthetic data and mocked provider requests/senders; they prove
neither physical-device display nor production receipt. Application source was
unchanged. Production deployment and callback readback are recorded below when
finished. No preview deployment is requested for this documentation.

Production activation completed at 08:33 UTC (09:33 Europe/Paris). Vercel redeployed
existing main to `wuff-todo-cwddmq7cp-tim-benniks-projects-1b967033.vercel.app`
and aliased the canonical origin. The pending publication moved to `scheduled`.
The real callback recorded two device-provider acceptances at
08:33:40–08:33:41 UTC, advanced job generation 22 to 23 and scheduled the next
repeat for 08:48:40 UTC (15 minutes later). No historical repeat backlog was
published. Actual device display remains for Tim to confirm. This validates
provider acceptance/repeat chaining, not every medicine schedule/device/watch
combination or a guarantee that a person saw the alert.
