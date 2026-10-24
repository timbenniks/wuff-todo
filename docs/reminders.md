# Personal reminders and Settings

Selected October 22, 2026. Core implementation built and verified locally; no production release or installed-device delivery is claimed.

## Product decisions

The user selected scheduled jobs instead of minute polling for the initial two-person installation, and asked for all delivery adapters together. Keep the existing date-only due date independent of a personal reminder instant. A reminder never assigns a task or changes its shared due date. Shared list access does not subscribe someone else or expose their devices, schedules, or notification preferences.

- `/settings` opens Reminders; `/settings/connections` houses existing MCP, GitHub and Cursor controls. Preserve `/connections`, including query parameters and old `#cursor` links.
- Personal settings: explicit opt-in daily nudge, local send time, IANA timezone, quiet hours and task-title privacy (titles hidden by default). Default timezone Europe/Paris matches the initial household; users can select their device timezone.
- Every current owner/editor gets “Reminders for me” within list settings. Include a list in the daily nudge by default, but send nothing until that account enables its daily nudge. Archived lists and inaccessible lists are excluded. Inclusion only controls the digest; an explicit task reminder remains personal and separate.
- Task action and detail drawer: Remind me, custom local date/time, one-hour snooze/replacement and removal. One active reminder per person/task; reminder revision is independent from list.version. Future instants are limited to one year. Quiet hours can move delivery later; the returned effective instant must be shown.
- Completion cancels everyone's reminders for that task. Reopening does not restore them. Parent/child completion remains independent. Deletion cascades. Archiving cancels task reminders; leaving/removal cancels that person's list task reminders. Notification click always rereads through current authorization.
- Send one grouped daily count of unfinished tasks due today/overdue from accessible, included, active lists. Parent and subtask dates count independently as in the existing task model.
- Delivery permission belongs to the OS/browser, independently from saved Wuff preferences. Removing a device stops future sends. Tokens never appear in settings responses or logs.

## Architecture and scheduling

Application tables in the existing Vercel-managed Neon database store preferences, personal list inclusion, devices, jobs and per-device delivery receipts. Domain services enforce current admission, scopes, membership, separate revisions and actor-scoped mutation receipts across HTTP, native bearer API and MCP. Keep server providers out of client bundles.

QStash delayed messages invoke a signature-verified Vercel route with only job UUID and generation. The callback rereads authoritative state; obsolete messages are harmless. Cancellations invalidate the generation immediately; remote cancellation is an optimization, not authority. A daily digest schedules its next job after delivery. Compute next local calendar day with Temporal so DST is not treated as 24 hours.

The free QStash delay maximum is seven days. Use at most six-day hops for longer deadlines: a real reminder wakes once per six days until its delivery time. No per-minute cron or permanently running worker. No task names, device addresses, or user IDs are sent to QStash. Pending publication is durable; reads/writes retry, and one daily recovery cron retries orphaned publication work. Scheduler configuration failures must remain visible as pending.

Callbacks use serialized job/device receipts so concurrent/repeated calls skip accepted sends. A process crash between provider acceptance and the database commit can still duplicate delivery; providers receive a stable tag/collapse identifier where supported. Delivery is at least once, not exactly once. Push acceptance is not proof a person saw a notification. Task jobs more than 24 hours late expire; overdue tasks still appear in the next daily digest.

## Delivery adapters

| Platform | Server transport         | Client/distribution gate                                                                                               |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Web      | Web Push/VAPID           | Push-only service worker, explicit permission and subscription; iPhone Home Screen installation                        |
| iOS      | APNs HTTP/2 alert        | Signed Tauri bundle, push entitlement, native token registration/rotation and cold/warm click handling                 |
| macOS    | APNs HTTP/2 alert        | Signed bundle/topic/entitlements, native registration and click routing                                                |
| Android  | FCM HTTP v1 notification | Firebase project/app, native Firebase Messaging registration/rotation and tap routing; Android notification permission |
| Windows  | WNS toast                | Registered app identity and WNS channel consistent with chosen packaging, channel renewal and activation handling      |

All native apps register transport-specific addresses with the existing bearer-only `/api/mobile` adapter. Device registration/removal and reminder operations are shared server contracts. A Tauri WebView is not treated as a browser PushManager. The latest Tauri client has browser sign-in, bearer APIs and shared list/task views. Reminder editors now use that shared UI and bearer adapter; remote-notification permission/token plugins are still a separate integration. Installed native proof is a release gate, not inferred from TypeScript or a Vite build.

## Delivery phases

1. Personal Settings experience, connection-link compatibility, domain/contracts/schema, list and task reminder controls, all server delivery adapters, delayed scheduling and push-only web worker.
2. Isolated-development migration and tests: access/revocation, personal isolation, safe retries, revisions/races, completion/reopen, timezone/DST/quiet hours, stale callbacks, multiple devices and partial-provider failure. Browser checks at 320/390/desktop.
3. Configure provider credentials in ignored environment files and the existing Vercel project. Prove a signed QStash callback and web subscription/delivery with disposable data. Do not mark real delivery enabled from provider-mocked tests.
4. Integrate native registration/permissions/deep links into the authenticated Tauri app against the existing authentication/live foundation and selected packaging. Test signed installed builds on all four platforms, including closed apps, token rotation, permission denial, logout/account switches and stale notifications.
5. Production migration/deployment and real-device smoke with explicit operational prerequisites satisfied. Preserve existing user/list/task/member data fingerprints; no managed-auth writes.

## Sources checked October 22

- [QStash delays and plan limits](https://upstash.com/docs/qstash/features/delay)
- [QStash signatures](https://upstash.com/docs/qstash/howto/signature)
- [Tauri notification display](https://v2.tauri.app/plugin/notification/)
- [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Windows notification overview](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/)

## Verification — October 22

- Drizzle generated additive `0013_vengeful_lila_cheney.sql` for the five application tables, plus custom `0014_reminder_completion.sql` for cancellation on any completed transition (including direct GitHub synchronization writes). Both applied to the existing isolated development branch. No production migration or auth-managed writes.
- `pnpm check`: 65 unit tests, workspace/root TypeScript and optimized web/MCP builds passed. Unit coverage includes all provider request formats with mocked network clients, permanent Web Push retirement, endpoint restrictions, DST/quiet hours and signed QStash URL/body/expiry/key-rotation verification.
- `tests/reminders.integration.test.ts`: real isolated-development transactions with fake senders proved personal isolation, editor access, independent list revisions, concurrent preference writes, safe retry fingerprints, device takeover denial, per-device callback receipts, partial-provider retry, personal digest inclusion, completion/reopening and revoked membership. No live provider was contacted.
- Chrome against the local production build proved Settings save/reload, task reminder save/remove/reload, independent owner/editor list preferences and owner-only shared controls. Measured document width fits 320, 390 and 1280px. Origin and unsigned callback/recovery guards reject requests; `/connections` retains listId and `#cursor` through redirection. Synthetic lists/jobs/devices were removed and prior fixture account preferences/digest records restored.
- A scan of optimized browser JavaScript found no reminder provider secret names or server device-table code. Initial runtime configuration checks confirmed scheduling and all five transports were unconfigured; QStash was subsequently provisioned as recorded below.
- `pnpm build:native:web` passed; this proves frontend compilation, not installed push delivery. New native reminder client methods are TypeScript checked. No Tauri remote-notification plugin, signed installer, physical-device registration or closed-app delivery has been verified.
- MCP reminder tools and embedded task/list controls build successfully. Named ChatGPT/Codex interactive-host usage and native API notification registration are separate live checks.
- Subsequent infrastructure setup: QStash was provisioned through Vercel CLI on the free Frankfurt plan and connected to Production. Its four environment variables are installed, and a read-only SDK call authenticated successfully (zero active schedules). No message was published, application deployed, or production reminder migration applied. Actual QStash callback delivery and Web Push/APNs/FCM/WNS delivery remain unverified. See [operations](development.md#qstash-provisioning-completed--october-22).

Screenshots: [Settings 390px](screenshots/reminders-settings-390.png), [Settings 320px](screenshots/reminders-settings-320.png), [task reminder](screenshots/reminders-task-390.png), [list preferences](screenshots/reminders-list-390.png). Repeatable browser check: `node --env-file=.env.local --import tsx scripts/verify-reminders-ui.ts` with the isolated local production server on port 3001 and WUFF_ORIGIN set to that same origin.

Native integration uses `NativeReminders` from `@wuff/client` against the existing authenticated client. The platform plugin requests permission, obtains APNs/FCM tokens or a WNS channel, then calls `register` with a fresh operation ID. On token rotation, register the new address then remove the old device ID; on sign-out, remove the registered device before revoking the session (or keep an explicit user opt-in to background notifications). Browser sign-out unsubscribes its PushManager subscription before signing out. Notifications already displayed cannot reliably be withdrawn across devices; opening them always checks current access.

The initial Windows sender uses a **packaged app notification channel** and WNS toast XML with application credentials. It is not interchangeable with the Windows App SDK raw channel/Entra credential flow. Choose and prove that packaging/channel model before registering a Windows device. Until app-link activation is configured, the toast's HTTPS activation opens the authorized website.

## Integration with latest main — October 22

Prepared on `codex/personal-reminders` from `origin/main` at `862e278` (merged Tauri auth, Realtime, shared controls and core views through PR #15). The original working checkout and the separate platform-build PR were preserved. No edits to `docs/tauri-client.md` were included.

Reminder task/list editors now live in `packages/ui/src/features/components/reminders` beside the shared views and use the injected `FeatureRuntime.api`. Website sign-out unsubscribes browser notifications in the website runtime; native sign-out stays native. The native feature adapter maps reminder reads/writes and local-time resolution to identity-pinned bearer operations. Account-wide Settings currently opens the authenticated website from native navigation. Native push permission/token registration remains a separate gate.

Reconciliation verification: frozen-lockfile install, `pnpm check` (80 unit tests, workspace/root typecheck, optimized web/MCP builds), provider-mocked development reminder integration, `pnpm build:native:web`, and iOS/Android exports plus their existing bundle/secret scan all passed. Chrome repeated Settings/task save/reload/removal, independent owner/editor list settings, 320/390/1280px overflow checks, origin/signature guards and `/connections` query/fragment compatibility against the merged production build. Web and Tauri JavaScript scans found no reminder provider secret names or server device-table code. The lockfile preserves main's existing dependency graph and adds only reminder dependencies.

Callbacks take list locks before personal actor/job locks on both task and digest paths to match shared-list mutation ordering. Actual installed Tauri notification registration, live QStash message delivery, push-provider delivery and production reminder migrations/deployment remain unverified/unperformed for this PR.

## UX readiness — October 24

Local UX Phase 5 leads with scheduling/service/device/permission status before
schedule controls and explicitly distinguishes those states from verified
notification delivery. Preferences can be saved while delivery is unavailable.
Quiet-hours copy shows timezone and adjusted daily time. Uncertain task/list/daily
preference saves retain the original payload/operation ID for explicit retry;
known conflicts retain drafts until the user chooses to load latest. Device
registration does not claim delivery. Provider/device release evidence remains
separate from this UI work; see verification.
