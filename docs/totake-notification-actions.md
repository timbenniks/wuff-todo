# Totake web notification actions — October 25

## Brief and acceptance

Tim requested a new branch implementing Totake's notification behavior correctly
against its strict existing medicine/equipment rules. Base main: 753c52c. Root
AGENTS.md, apps/web/AGENTS.md, wuff-contributor and current contributor/product/
architecture/development/verification/module/surface guides apply. Totake owns
item/action policy; Empire owns the push worker, device transport and privacy.

- [x] Real occurrence IDs open the correct account/reminder, including DST splits.
- [x] One explicitly identified due item supports Taken/Done and Snooze 15 min.
- [x] Grouped/private notifications open review; no blind group completion.
- [x] Full checklist retains partial Taken/Done, Skip, 15/30/45/60 snooze, Undo and explicit date/time scopes.
- [x] Shortcuts reject stale/changed/resolved/undone/future/snoozed items, expired contexts, account switches, revoked devices and current pause/privacy denial.
- [x] Exact retry prevents double records/stock movements. Uncertain or offline outcomes never claim success or queue offline writes.
- [x] Notification dismissal never records or snoozes anything. Repeat cadence, unresolved items, stock and immutable history retain current semantics.

## Surface and security contract

Reuse GET/PUT /api/v1/totake, get_totake/update_totake and native getTotake/
updateTotake, all through the same domain services. Add an optional strict
notification context to the existing mutation contract for additional account,
device, expiry and exact-item/history guards; no new scopes or unsigned
unauthenticated action endpoints. Browser session authentication and X-Wuff-User
pinning remain mandatory. Worker reads authoritative state before writing its
current version and retries an uncertain write with the identical payload once.
All OS shortcuts are explicit clicks. No notification contains a bearer token.

Existing MCP App covers complex selection and Undo; OS permissions/actions use
the browser handoff. Typed contracts and server checks apply equally to MCP/native
calls. No migration, new credential, native permission, provider provisioning,
Totake production enablement or release. Tim retains operational/merge authority.

## Planned tests

Pure policy, strict contract and actual worker push/click handler tests: correct
IDs, account pinning, single/group/hidden content, all snooze choices, stale/history
and expiry checks, network failure, retries, duplicate and unsupported-browser
fallback. Isolated real domain and HTTP/MCP/native tests verify selected records,
stock, undo, permissions/revocation, version races and receipt replays. Optimized
browser checks cover reminder handoff, four durations/partial selection, account
mismatch, exact retries and 320/390/1280px. No production integration writes or
real medicine fixtures. Actual phone/watch delivery remains a device gate.

## Evidence

Implementation and verification in progress. GitHub billing has prevented hosted
jobs from starting; keep draft if hosted checks remain blocked. No actual watch
button compatibility or real push receipt is claimed.

## Implemented behavior and decisions

A notification with one identified, due, unresolved item and visible content gets
Taken (medication) or Done (equipment), plus explicitly labelled Snooze 15 min.
Other allowed durations remain in the existing app. Groups and hidden-content
notifications have Review items and Snooze…; the latter opens the exact checklist
and focuses its 15/30/45/60 duration selector. Body taps always open review. Skip,
partial selection, Undo and explicit one/future date/time edits remain in the
full existing app. No notification checkbox, silent group completion or native
watch action support is invented.

The optional `notification` mutation precondition binds user, registered web
device, group, one item’s displayed identity, its latest immutable audit entry and
an issued/expiry interval. The one-hour limit expires only a shortcut; it never
expires an unresolved medicine occurrence. The worker reads the actor-pinned
current version, validates the displayed item, then uses the existing PUT. The
server independently repeats the guards inside the transaction and serializes
pause/privacy/device checks under the shared notification lock before Totake's
lock. Ordinary explicitly chosen app/MCP/native actions remain unchanged. This
context is a precondition, not authorization: a valid admitted session/grant,
existing Totake permissions, account pin and current version are still required.
There is no capability token, unauthenticated write route or new OAuth scope.

Receipt replay is checked after live admission/device/policy/expiry checks, before
item resolution/version checks. It cannot duplicate recording/stock after a lost
reply; an old notification with a fresh operation ID cannot record after Undo
because its audit binding changed. The worker also checks the authoritative result
before displaying confirmation, and retries an uncertain PUT only once using the
identical JSON and operation ID. It never queues offline writes. Failed/stale/
unauthenticated/conflicting/unconfirmed actions show generic feedback and open
review. If OS feedback display fails, review still opens without another mutation.

Server callback payloads use real bounded calendar occurrence IDs, including
`@instant` DST splits, and pin the account in review links. Expired-login return
paths preserve only validated Totake query parameters. An account mismatch cannot
open the other account’s same-day group. Legacy notifications lacking an account
pin open the overview instead of guessing. Totake clicks open another window
rather than navigating away from an existing editor; an exact existing reminder
window is focused without reload. Dismissal has no mutation handler.

The typed worker is bundled by the existing build-mcp step to
`apps/web/public/reminder-worker.js`; its source is
`apps/web/src/workers/reminder-worker.ts`. Tests bundle that source directly, so a
stale generated file cannot pass worker behavior tests. Install/activate replace
the older worker promptly. No fetch interception, offline cache/background queue,
new dependencies, global styles, schema/migrations or native permissions were
added. The public contract adds only the optional guarded context and its
client-safe policy subpath. MCP tool schemas/descriptions must be refreshed by
clients; existing grants do not gain permissions.

Production Web Push keys were configured in the previous authorized setup. This
branch does not alter credentials, provision services, enable Totake delivery,
merge or deploy. Real phone/watch testing still requires release and explicit
Totake delivery enablement. All verification uses fictional development data.

## Local verification and review evidence

- `pnpm typecheck`: all workspaces and root scripts/tests passed.
- `pnpm test`: 221 tests passed, no skips. New
  `tests/totake-notification-actions.test.ts` covers real calendar/DST IDs and
  sign-in allowlist, control-character/duplicate/external query rejection,
  account mismatch, single medication/equipment versus group/private/future
  selection, strict context/expiry and all four durations, changed identity,
  snoozed/resolved items and Undo audit invalidation. Actual bundled worker
  handlers prove action limits/unsupported fallback, exact retries for lost
  committed replies and HTTP 5xx, no false success on unresolved 200 responses,
  stock/due preservation, unauthenticated/offline/conflict recovery, revoked OS
  feedback permission, expired shortcut versus persistent occurrence, lifecycle
  update and draft-preserving window handling. Existing web notification worker
  regressions now bundle typed source through a shared test helper.
- `pnpm build`: guide, MCP and optimized website passed. The worker is about 10KB
  unminified, with no server implementation or provider secret names in worker or
  browser chunk scans. A click performs one current-state GET and at most two
  identical PUT attempts; no periodic request or extra scheduler was added.
- `pnpm build:native:web` passed, with the existing >500KB chunk advisory. This
  proves frontend compilation only; there is no native permission/plugin change.
- Serial real isolated-development integration command for
  `tests/totake-notification-actions.integration.test.ts`,
  `tests/totake.integration.test.ts`, `tests/reminders.integration.test.ts` passed
  all four cases. The new case was rerun after adding real callback-payload
  capture and passed again: a mocked sender receives the actual web callback's
  account/device-bound context; real HTTP/MCP/native reads/writes exercise races,
  receipt replay, original stock/Undo, old-notice rejection after Undo, all four
  snooze durations, Skip without stock deduction, origin/account/readonly-scope
  rejection, live pause/privacy checks, device removal and token revocation.
  Current-state read and versioned write remain the same services on all adapters.
- `node --env-file=.env.local --import tsx
scripts/verify-totake-notification-actions.ts` passed against the optimized
  local app: real anonymous sign-in return path, wrong-account denial without a
  modal/write, exact group/checklist and focus, all four durations applied to one
  selected item while the other remains unchanged, partial Taken with a committed
  response deliberately lost and identical retry, Skip and Undo/stock readback,
  and 320/390/1280px overflow. Screenshots are
  `docs/screenshots/totake-notification-actions-{320,390,1280}.png`. No page errors.
  This check exposed and verified the dialog-focus timing fix. Harness selectors
  were corrected for the existing duplicate recovery controls/closed history.
- `WUFF_FIXTURE_PORT=4177 node --env-file=.env.local --import tsx
scripts/verify-totake.ts` passed existing real browser and actual MCP Apps SDK
  controls, selected recording/Undo/stock, exact lost-response retry,
  Cancel/conflict/load-latest and phone/desktop layout. Another project owned
  port 4173; its process was preserved. The existing harness now honors the
  fixture's configurable port for its page and interception URL. Reference
  screenshots generated by this rerun were restored to avoid unrelated changes.

Integration environment guard: existing isolated development endpoint only,
QStash disabled, fictional seeded account data only. Seed helper refuses any
pre-existing Totake aggregate; cleanup removes only fixtures and restores prior
notification settings. No production data writes, remote provider sends,
provisioning, new credentials, native release, production flag or deployment.
Browser API/VM and local SDK evidence is not physical Android/watch delivery,
lock-screen behavior, screen-reader certification or a named production MCP host.

GitHub Verify run 40231995256 did not start because account payments/spending
limits blocked runners. Hosted verification is incomplete; keep PR #35 draft
until Tim resolves the runner gate and reviews. Release and installed phone/watch
acceptance remain separate. Garmin custom buttons are not promised.
