# Web notifications — October 25, 2026

## Brief and acceptance

Build browser push for the household on latest main, using Empire Notifications,
existing personal device services and Todo/Totake scheduling. Root AGENTS.md,
apps/web/AGENTS.md and the wuff-contributor skill govern this feature. Empire owns
browser delivery; product schedules and global/app pauses remain independent.
Native providers, plugins, signing and releases are outside this phase.

- [ ] Supported browsers can explicitly enable push and reconnect an existing subscription.
- [ ] Unsupported/iPhone installation, denied permission and setup failures give actionable recovery.
- [ ] Removing this browser also unsubscribes it; sign-out cannot leave an active browser subscription.
- [ ] Browser subscription JSON is accepted without leaking addresses/keys in responses.
- [ ] Notifications open only authorized same-origin Todo/Totake routes; no offline caches.
- [ ] Web keys can be generated privately without replacing existing keys; production configuration/release requires Tim's operational authorization.

## Surface and connection contract

Reuse registerReminderDevice/saveReminderDevice and removeReminderDevice/
deleteReminderDevice, POST /api/v1/reminders device/removeDevice and existing
register_reminder_device/remove_reminder_device MCP tools. Authorized settings
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

Implementation/verification in progress. No new provisioning, production changes,
release or real notification delivery is claimed. VAPID keys must stay stable once
subscriptions exist. Production QStash is already configured; web credentials and
physical-browser delivery remain separate gates.
