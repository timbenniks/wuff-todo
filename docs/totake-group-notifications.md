# Totake grouped notifications — October 26

## Brief and acceptance

Use the supplied visual reference to make due notifications informative and actionable.
Root AGENTS.md, apps/web/AGENTS.md and wuff-contributor apply. Totake owns payloads,
action contracts and domain validation; Empire owns the shared push worker/transport.

- [ ] Titles show the due selection count and scheduled local time.
- [ ] Names/quantities remain behind the existing lock-screen detail preference; no silent privacy change.
- [ ] Grouped due selections offer Confirm all and 30 min later. Skip all is available when the platform supports a third button, otherwise through the existing reminder checklist.
- [ ] All actions target exactly the delivered item snapshot. Changed/resolved/snoozed/newly due selections require review, not a partial or broadened mutation.
- [ ] Current account/device/privacy/pause/version and receipt guards apply before writes. Exact retries cannot duplicate records or stock deductions.
- [ ] Old single-item Taken/Done and Snooze 15 min notices remain supported.
- [ ] Unit, actual HTTP/MCP/native parity and isolated callback/worker checks pass; no real medicine fixture or production send.

No schema migration, credential/consent/scope change, provider provisioning or native
permission change. The optional bounded notification selection context extends the
existing shared mutation contract. Same updateTotake domain operation, PUT
/api/v1/totake, update_totake and native updateTotake support record/skip/snooze.
Existing MCP UI/checklist remains complete; no new embedded UI is necessary.
No new dependency/global CSS. No manual preview or production operation is requested.

## Verification plan

Regression cases: real payload title/body privacy, exact group selection, stale
identity/history, due/future/snoozed membership, account/device/policy revocation,
expiry, duplicate receipt and concurrent record/snooze, worker action limits and
lost-response retry. Exercise 0/1/2/3 action limits, success and review fallbacks,
actual adapters with fictional data and existing responsive checklist behavior.
Run pnpm typecheck, pnpm test, pnpm build and serial relevant integration checks.
