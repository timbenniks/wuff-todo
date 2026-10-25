# QStash scheduling ID regression — October 25, 2026

## Brief and acceptance

Tim supplied a confirmed production failure: a correctly saved Todo reminder
stayed pending because QStash rejected its colon-separated deduplication ID with
HTTP 400. An authorized retry sent nothing. Both Todo and Totake publishing paths
use this invalid format. Fix within existing draft PR #35, as Tim requested,
without changing the notification action feature or operational authorization.
Latest main 753c52c is already an ancestor of the current branch.

Root AGENTS.md, wuff-contributor and current implementation/product/architecture/
development/verification, contributor and module/surface guides apply. This is
shared server scheduler policy used by the existing product-owned publishing paths.

- [x] Provider-compatible deterministic IDs separate product/job/version/wake minute.
- [x] Identical retries deduplicate; minute/version/product/job changes stay separate.
- [x] Both actual publishing paths tested through the SDK with intercepted HTTP and isolated DB rows.
- [x] Rejected/unknown replies leave jobs pending; accepted replies alone mark scheduled.
- [x] Six-day hops, readiness, user filters, paused/disabled jobs, Totake transport readiness and delivery gate remain unchanged.
- [x] pnpm typecheck, pnpm test and relevant integration checks recorded.

## Surface and operational boundaries

No new public capability, schema, token or UI. Existing authorized reminder and
Totake API/MCP services still create/version/cancel the same jobs; publisher uses
the same durable rows, callback body and version guards. No scope/consent/MCP App
change from this scheduler fix. Existing PR #35 action-contract work remains
separate in its existing scope and tests.

Unit coverage will verify deterministic provider-safe identity and boundaries.
Integration will exercise both actual schedulers and real SDK HTTP headers with
fake credentials, fail-closed HTTP interception and fresh synthetic application
rows on the existing isolated development branch. No auth-managed writes.

No manual preview deployment. No production retry, test send, enabling Totake,
merge or release is authorized by this fix request. After merge/deployment, obtain
explicit authorization before separately checking provider scheduling acceptance
and actual browser receipt. A QStash message ID is not proof of device receipt.

Provider reference: [deduplication](https://upstash.com/docs/qstash/features/deduplication)
explains that an identical ID deduplicates within ten minutes and duplicate publish
returns the original message ID. The colon restriction is confirmed by the
production diagnostic supplied by Tim; no new production probe is needed.

## Fix and regression evidence

Both product-owned schedulers now use `schedulerDeduplicationId` in the existing
server-only platform scheduler module. It SHA-256 hashes the JSON tuple
`[product, jobId, version, floor(wakeAt / 60000)]` to exactly 64 lowercase hex
characters. JSON tuple boundaries avoid ambiguous delimiter replacements. The
same tuple remains identical; changing product, job, version or wake minute gives
a separate ID. Existing wake calculation and publication bodies/options, five
provider retries, row/version guards, permissions, pauses, transport readiness
and Totake opt-in gate are unchanged. No schema, dependency, public API/tool or
MCP App UI change is required for this fix.

`tests/scheduler-publishing.integration.test.ts` was run before the fix and failed
on the actual outgoing Todo SDK header containing colons. The same regression
passes after both call sites use the helper. It invokes the actual schedulers,
Drizzle/isolated Postgres and installed SDK; all HTTP is intercepted fail-closed
with fake credentials/test origins. Fresh synthetic application users/jobs are
inserted and deleted with cascades; no auth-managed identity or real user rows
are changed. The real QStash service is never contacted.

The regression covers both products with the same job UUID/version/minute;
provider-safe distinct headers and exact callback bodies/routes; six-day hops,
near-term deadlines and one-second overdue wake; HTTP 400 with enabled/pending
rows and no message ID; provider acceptance followed by an unreadable reply,
then identical-ID 202 deduplication and no second simulated enqueue; scheduled
rows not republished; generation/minute separation; stale publisher responses
not marking a newer generation scheduled; global and independent product pauses;
user filtering, disabled jobs, scheduler readiness, Totake's opt-in gate and
missing transport configuration. Publishing alone creates no delivery receipts.

`tests/scheduler.test.ts` verifies bounded safe IDs, identical retries/same-minute
stability, every tuple dimension and minute boundary, and unambiguous identities
for delimiter-like inputs. Existing adapter/permission/revocation/notification
action integration suites remain the broader surface regression evidence.

Final local checks for this addition:

- `pnpm typecheck`: all workspaces and root scripts/tests passed.
- `pnpm test`: 224 passed, no skips (including the three scheduler unit cases).
- `pnpm build`: guide/MCP and optimized web build passed; no deployment.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/scheduler-publishing.integration.test.ts tests/reminders.integration.test.ts
tests/totake.integration.test.ts tests/totake-notification-actions.integration.test.ts`:
  all five real isolated-development cases passed, no skips. This includes both
  actual publisher paths and existing permission, idempotency, revocation,
  notification pause, current-state callback, repeat, stock and guarded-action
  regressions. The publisher case also proves independent app pauses and that a
  reply for an obsolete version cannot mark a newer generation scheduled.
- `git diff --check` passed. No UI/native/contract change in this scheduler fix;
  earlier PR #35 UI/SDK evidence applies to unchanged UI source, with the affected
  backend checks rerun here.

Local SDK acceptance in these tests is simulated: it is not live provider
acceptance or browser receipt. No manual preview deployment, production retry or
test send has been performed.

After Tim merges/releases, first obtain explicit authorization before any
production retry. Check provider acceptance (message ID and scheduled status)
independently from actual browser receipt/click, with separate results. Do not
turn an authenticated production status read that republishes pending jobs into
an unapproved retry. Keep Totake's production delivery flag unchanged. GitHub
hosted runner billing remains a review gate; retain the PR as draft while checks
are blocked.
