# Web notifications — October 25, 2026

## Brief and acceptance

Build browser push for the household on latest main, using Empire Notifications,
existing personal device services and Todo/Totake scheduling. Root AGENTS.md,
apps/web/AGENTS.md and the wuff-contributor skill govern this feature. Empire owns
browser delivery; product schedules and global/app pauses remain independent.
Native providers, plugins, signing and releases are outside this phase.

- [x] Supported browsers can explicitly enable push and reconnect an existing subscription.
- [x] Unsupported/iPhone installation, denied permission and setup failures give actionable recovery.
- [x] Removing this browser also unsubscribes it; sign-out cannot leave an active browser subscription.
- [x] Browser subscription JSON is accepted without leaking addresses/keys in responses.
- [x] Notifications open only authorized same-origin Todo/Totake routes; no offline caches.
- [x] Web keys can be generated privately without replacing existing keys; production configuration/release requires Tim's operational authorization.

## Surface and connection contract

Reuse registerReminderDevice/saveReminderDevice and removeReminderDevice/
deleteReminderDevice, POST /api/v1/reminders device/removeDevice. Existing get_reminder_settings
returns the secure /settings/notifications handoff for browser registration;
remove_reminder_device exposes equivalent authorized removal. Authorized settings
reads use getReminderSettings on HTTP/MCP. Existing notifications:read/manage
consent and personal device ownership remain unchanged; browser permission and
subscription secrets are obtained only through the browser handoff. Tools remain
complete for authorized device metadata/removal; MCP cannot prompt a user's OS.
No schema change. Existing MCP App reminder controls need no browser PushManager
inside a sandboxed host. Device setup stays in authenticated Empire Settings.

## Verification plan

Meaningful unit tests exercise browser enable/recovery/unsubscribe and real worker
push/click handlers, malformed payloads, safe routes and window reuse. Verify
subscription schema acceptance, current account guards, adapter parity and device
isolation with synthetic isolated development data. Run pnpm typecheck, pnpm test,
web build and responsive browser checks (320/390/1280px). Distinguish mocked browser
push from a real installed/Home Screen device. No production test writes.

## Evidence and rollout

Local implementation is verified below. No new provisioning, production changes,
release or real notification delivery is claimed. VAPID keys must stay stable once
subscriptions exist. Production QStash is already configured; web credentials and
physical-browser delivery remain separate gates.

## Implementation decisions

- Accept the standard optional/null finite `expirationTime` in browser subscriptions;
  retain strict validation of endpoints, encryption keys and other unknown fields.
- Permission is requested only from an explicit Enable click. Existing subscriptions
  reconnect without duplicating devices. A changed VAPID key requires explicit
  disconnect rather than silently rotating a person's subscription.
- Turn off this browser unsubscribes at the browser first, then removes only the
  actor's endpoint through the existing idempotent service. An uncertain server
  reply retains the exact endpoint/operation ID for retry. Remote device removal
  stops server sends; the other device manages its own OS subscription.
- Sign-out unsubscribes before best-effort server cleanup. A failed cleanup leaves
  an unsubscribed endpoint that the existing permanent-failure retirement handles.
- Push/click paths allow Todo tasks/lists and Totake reminder links. Both stages
  validate paths, including notifications displayed before the current worker.
  Malformed pushes show generic content rather than becoming invisible pushes.
  A closing/failed window falls back to opening an authorized page. No fetch
  handler, offline cache, native registration or automatic permission prompt.
- Setup uses `node scripts/setup-web-push.mjs .env.web-push.local
https://wuff-todo.vercel.app`. The helper generates P-256 keys, writes a new file
  with mode 0600 and exclusive creation, and never prints/overwrites key values.
  Use separate stable keys per environment; development credentials were generated
  only in this worktree's ignored files. No dependency, global CSS, schema, native
  permission, public tool name or consent scope change.

## Production activation handoff

After Tim explicitly authorizes production configuration, check the existing
Vercel project's WEB_PUSH_* inventory before generating/installing anything. Reuse
any existing pair; never rotate it as a setup retry. Store WEB_PUSH_PUBLIC_KEY,
WEB_PUSH_PRIVATE_KEY and WEB_PUSH_SUBJECT via Vercel CLI from private files, retaining
QStash and all database/auth configuration. A deployment is needed to receive new
environment values. Tim reviews/merges the feature PR. No migration is required.

Then enable a browser from Settings → Notifications. On iPhone, use Safari's
Share → Add to Home Screen and open Wuff from that icon before enabling. Schedule
a personal test task reminder and confirm receipt/click with the page closed.
Todo uses the existing QStash setup; Totake delivery retains its separate existing
WUFF_TOTAKE_DELIVERY_ENABLED gate. This feature does not silently enable it.
Provider acceptance, OS display and a person seeing a reminder are different claims.

## Verified locally

- `pnpm typecheck`: workspace and root scripts/tests passed.
- `pnpm test`: 207 tests passed, no skips. `tests/web-notifications.test.ts`
  covers standard/null/finite/invalid expiry, endpoint/key mismatch, permission
  order/denial/dismissal, unsupported environments, reconnect without duplicate
  subscriptions, changed key recovery, startup failure, failed/successful
  unsubscribe, signout cleanup failure, malformed push visibility, safe Todo/Totake
  routing, stale external click paths and closing-window fallback.
  `tests/web-push-setup.test.mjs` proves a matching P-256 pair, private file mode,
  invalid subject rejection and no overwrite/rotation.
- `pnpm build`: guide, embedded MCP and optimized web build passed. Browser chunk
  scans check that server push credentials/device-table implementation stay out
  of client output. No new dependency or native code was introduced.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/web-notifications.integration.test.ts tests/reminders.integration.test.ts`:
  both real isolated-development cases passed. Standard browser JSON registers
  through HTTP; real MCP reads its safe metadata/setup handoff and removes it;
  browser disable is reflected by MCP. Exact retries, ownership takeover denial,
  cross-account removal no-op, origin/account guards, bad expiry, insufficient
  scopes and revoked-token receipt replay are checked. Existing reminder
  concurrency/lifecycle/partial-provider failure/deduplication tests also pass.
- `node --env-file=.env.local --import tsx scripts/verify-web-notifications.ts`:
  optimized local website, real HTTP/database and mocked browser permission/
  PushManager. Denial then settings recovery, registration and disconnect with
  deliberately lost committed responses and identical retries, one persisted
  device, reconnect without a second subscribe, unsupported-browser guidance,
  keyboard activation and long-label layouts at 320/390/1280px passed. Screenshots
  are `docs/screenshots/web-notifications-{320,390,1280}.png`. No captured page
  errors. The harness supplies the tsx name helper inside its serialized browser
  mock; earlier harness serialization/strict text-selector mistakes were fixed.
- Vercel's existing Production environment was inspected read-only: all four
  QStash names exist and no WEB_PUSH_* names exist. No values were displayed or
  changed. Development-only keys live in ignored private files in this worktree.

Synthetic devices are removed and test OAuth grants revoked. No notification
provider was contacted by these checks. Browser API mocks and worker VM tests do
not certify real push receipt, closed-page delivery, physical iPhone/Home Screen
behavior, screen readers or named production MCP hosts. Production configuration,
merge/release and real-device receipt remain maintainer gates. Preview backend
isolation is unconfirmed, so no preview writes are used as evidence.

Standards checked: [PushSubscription JSON](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/toJSON),
[permission/user gesture and visible Safari pushes](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
[iPhone Home Screen web push](https://webkit.org/blog/13878/).

## Hosted review gate

GitHub Verify run 40229885611 did not start: the account's recent payments/spending
limit blocked runners. Contributor policy is also blocked by runner availability.
These are incomplete hosted checks, not passing CI. The PR remains a draft.
Tim must resolve the account runner gate and review the change before merge.

## Authorized production credential setup — October 25

Tim explicitly authorized generating and installing web push credentials. A fresh
read of the existing Vercel project's Production environment found no WEB_PUSH_*
entries. A separate Production P-256 pair was generated into the ignored private
`.env.web-push.production.local`, validated locally and installed through Vercel
CLI as three Production Secrets: WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and
WEB_PUSH_SUBJECT. A subsequent inventory verified exactly one entry for each.

Only those three values were added to the original checkout's ignored
`.env.production.local` backup; unrelated database, auth, QStash and development
configuration was preserved. Keys were not printed and no existing pair was
rotated. The subject is the canonical public Wuff HTTPS origin.

No merge, application deployment, production test write, test notification or
Totake delivery-gate change occurred. A future production deployment must load
these variables, followed by a real browser subscription/receipt test. PR #34
remains draft: the latest inspected Verify run 40230760272 was not started because
GitHub account payments/spending limits block runners. Local verification above
remains the implementation evidence; this follow-up changes documentation only.
