# Totake web notification actions — October 25

## Brief and acceptance

Tim requested a new branch implementing Totake's notification behavior correctly
against its strict existing medicine/equipment rules. Base main: 753c52c. Root
AGENTS.md, apps/web/AGENTS.md, wuff-contributor and current contributor/product/
architecture/development/verification/module/surface guides apply. Totake owns
item/action policy; Empire owns the push worker, device transport and privacy.

- [ ] Real occurrence IDs open the correct account/reminder, including DST splits.
- [ ] One explicitly identified due item supports Taken/Done and Snooze 15 min.
- [ ] Grouped/private notifications open review; no blind group completion.
- [ ] Full checklist retains partial Taken/Done, Skip, 15/30/45/60 snooze, Undo and explicit date/time scopes.
- [ ] Shortcuts reject stale/changed/resolved/undone/future/snoozed items, expired contexts, account switches, revoked devices and current pause/privacy denial.
- [ ] Exact retry prevents double records/stock movements. Uncertain or offline outcomes never claim success or queue offline writes.
- [ ] Notification dismissal never records or snoozes anything. Repeat cadence, unresolved items, stock and immutable history retain current semantics.

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
