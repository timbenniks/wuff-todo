# Totake grouped notifications — October 26

## Brief and acceptance

Use the supplied visual reference to make due notifications informative and actionable.
Root AGENTS.md, apps/web/AGENTS.md and wuff-contributor apply. Totake owns payloads,
action contracts and domain validation; Empire owns the shared push worker/transport.

- [x] Titles show the due selection count and scheduled local time.
- [x] Names/quantities remain behind the existing lock-screen detail preference; no silent privacy change.
- [x] Grouped due selections offer Confirm all and 30 min later. Skip all is available when the platform supports a third button, otherwise through the existing reminder checklist.
- [x] All actions target exactly the delivered item snapshot. Changed/resolved/snoozed/newly due selections require review, not a partial or broadened mutation.
- [x] Current account/device/privacy/pause/version and receipt guards apply before writes. Exact retries cannot duplicate records or stock deductions.
- [x] Old single-item Taken/Done and Snooze 15 min notices remain supported.
- [x] Unit, actual HTTP/MCP/native parity and isolated callback/worker checks pass; no real medicine fixture or production send.

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

## Decisions and compatibility

The existing notification context gains an optional `items` snapshot (2–100 unique
IDs with exact item identities and last audit IDs). Its existing first-item fields
remain for old single-item notices. Every selection is checked against currently
due, unresolved, unsnoozed items; newly due/resolved/changed/history-invalidated
selections require review. Normal repeat advancement after delivery does not
invalidate its own notice. Single-item Taken/Done and 15-minute buttons are retained;
new group buttons confirm all, snooze 30 minutes, and skip all only where a third
button fits. A two-button platform opens the existing checklist for Skip selected.

Counts and scheduled time are shown with the account's timezone, including privacy
mode. Medication names/doses and direct action metadata remain behind the existing
explicit lock-screen-content preference, which this PR does not enable or change.
The displayed body is bounded. Oversized UTF-8 payloads omit direct metadata and
use review buttons; the full Web Push payload is bounded to 3500 bytes, below the
[RFC 8291 plaintext ceiling](https://www.rfc-editor.org/rfc/rfc8291.html#section-4).
No partial group action is offered just to fit a provider limit.

The same optional context flows through existing HTTP/native/MCP mutation schemas
and the shared domain validator; it grants no authorization. Account admission,
OAuth scopes, device ownership, global/app pause, current privacy/expiry, optimistic
version and exact-payload receipt rules remain unchanged. No new MCP renderer or
scope is needed; existing interactive group selection and tool-only capabilities
already support record/skip/snooze/Undo. Historical single-item design is recorded
in [the original notification actions](totake-notification-actions.md).

## Verification

Before implementation the new grouped-selection regression failed (0/1 passed).
After implementation full unit discovery passes 231 cases with no skips;
`pnpm typecheck` passes all workspaces and root. The optimized production build also passes. Tests use the existing
isolated development backend, synthetic accounts and mocked providers. No production
operation or new provider send occurs during this feature work.

Final application source tested: `85bbe4008a6055cc334a27f5abba47251f8cc125`.
- `pnpm typecheck`: all workspace and root checks passed.
- `pnpm test`: 231 passed, no skips. New tests exercise actual grouped worker
  handlers, strict selection snapshots, private/expired/unsupported fallbacks,
  exact lost-committed-response retry, partial-result denial and UTF-8 payload limits.
- `pnpm build`: generated worker, guide, MCP bundle and optimized website passed.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1 tests/totake-notification-actions.integration.test.ts tests/totake.integration.test.ts tests/scheduler-publishing.integration.test.ts`:
  five real isolated-database cases passed, no skips. Both single/grouped callbacks
  feed actual HTTP/MCP/native mutations. HTTP confirmation/MCP readback and exact
  receipt replay, MCP grouped Skip/HTTP readback, native grouped 30-minute Snooze/
  HTTP readback, readonly/revoked consent, account/origin/device/privacy/pause guards,
  conflicts/concurrent clicks, unchanged stock on Skip/Snooze and complete Undo
  all passed. Provider requests/sends are mocked; no real notification is sent.
- `node --env-file=.env.local --import tsx scripts/verify-totake-notification-actions.ts`:
  optimized Chrome review/checklist, sign-in/account pin, exact group selection,
  all four app snooze options, untouched unselected item, uncertain committed
  record/retry, Skip and Undo/stock passed. Focus/overflow at 320/390/1280px passed;
  no captured page errors. Screenshots `totake-group-review-{320,390,1280}.png`
  show the real web review fallback, not an OS notification simulation.
- `git diff --check`: passed. Source checkout's unrelated pnpm changes preserved.

Hosted Verify run 40298849131 and policy run 40298846060 did not start: GitHub
account payments/spending limits blocked runners. This is incomplete hosted
verification, not a code failure/pass. Keep PR #37 draft. Real Android/iPhone/macOS
notification display/actions and watch behavior remain post-merge device checks;
browser-specific action counts and OS-controlled chrome cannot be guaranteed.
No manual preview, production operation, migration, native release or real-data
fixture was performed for this PR. Synthetic data is cleaned and test grants revoked.
