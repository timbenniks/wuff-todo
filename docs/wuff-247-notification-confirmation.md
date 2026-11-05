# WUFF-247: no extra notification after Taken/Done

## Brief and acceptance

Taking medication from a Totake notification currently closes the reminder and
then displays another OS notification saying it was recorded. Remove that extra
success notification for Taken/Done and grouped Confirm all. Preserve the
authoritative recording/readback, original notification dismissal, exact retries,
stock handling and error recovery. Snooze and Skip feedback are outside this fix.

Root `AGENTS.md`, `apps/web/AGENTS.md`, the repository wuff-contributor skill and
the current contributor/product/architecture/development/verification and module/
surface guides apply. Empire owns the shared push worker; Totake owns the guarded
recording operation. Branch: `codex/wuff-247-no-confirmation-notification`.

- [ ] Successful Taken/Done and Confirm all close the original reminder without
  showing a replacement success notification or opening Wuff.
- [ ] An uncertain reply retries the identical operation once, preserving exactly
  one record/stock deduction per selected item.
- [ ] Failed, stale, unauthorized or unconfirmed actions still show recovery
  feedback and open the account-pinned review page; unavailable OS feedback must
  still allow review.
- [ ] Existing Snooze/Skip feedback and reminder delivery remain unchanged.

## Surface contract and scope

Only notification presentation changes. Existing authenticated GET/PUT
`/api/v1/totake`, `get_totake`/`update_totake` and their shared authorized domain
services retain the same contracts and persistence. No new mutation, HTTP/MCP
capability, MCP App control, scope, consent, credential, device registration or
revocation behavior is introduced. The MCP App already offers recording/history/
Undo; OS notification feedback belongs to the web/PWA worker.

No schema, dependencies, styles, configuration, safeguards, migration or deployment
changes. No production writes or real medication fixtures. The existing local
app configuration points at main data, so verification must use synthetic
in-memory fixtures without live backend requests.

## Verification plan and evidence

Run the actual bundled worker unit tests with synthetic records: single
medication/equipment and grouped success, uncertain-response retry, stock,
unchanged snooze/skip, failure and denied-display recovery. Demonstrate a
regression fails before the worker fix. Run workspace TypeScript, all unit tests,
the worker/MCP bundle and a browser service-worker check with isolated synthetic
responses. Record actual results here and in the draft PR. Real Android/watch
delivery and production release remain separate checks.

Implementation and verification pending.

## WUFF-246: full-screen lock-screen alerts

Also investigate WUFF-246 in this PR. It requests a full-screen notification above
the lock screen, like MyTherapy. The [Notifications API options](https://notifications.spec.whatwg.org/#dictdef-notificationoptions)
expose notification content/actions and presentation preferences, but no Android
full-screen intent. `requireInteraction` is only a preference to retain a notice
on sufficiently large screens; it cannot implement this phone lock-screen flow.
[Android's full-screen notifications](https://developer.android.com/develop/ui/compose/notifications/create-notification)
require a native activity/full-screen intent and `USE_FULL_SCREEN_INTENT` permission.
[Android 14+ restrictions](https://source.android.com/docs/core/permissions/fsi-limits)
also limit default permission grants to calling/alarm functionality.

The supported web/PWA/MCP architecture cannot deliver the requested automatic
full-screen takeover. Do not replace it with a misleading web setting or revive
retired native apps in this fix. WUFF-246 remains unimplemented/open pending a
separate product/platform decision. Notification delivery and phone-controlled
lock-screen presentation remain separate from the WUFF-247 success-feedback fix.
