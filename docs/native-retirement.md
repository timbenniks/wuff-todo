# Web, MCP and PWA only — October 26, 2026

Tim explicitly retired native apps and all Tauri support. Root AGENTS.md and
wuff-contributor apply. This PR supersedes the documentation-only public-safeguard
PR #39 and includes its verified CI/ruleset evidence and resolved guide finding.

- [x] Remove Tauri workspace, native SDK, release scripts/workflow and their retired-product tests.
- [x] Retire native registration and bearer API endpoints with explicit non-data responses; reject native identities/resources in OAuth without weakening MCP.
- [x] Keep web/PWA service-worker notifications, HTTP API/MCP parity and shared browser utilities.
- [x] Update current architecture, contributor/module guidance, commands and dependencies; mark historical native evidence as retired.
- Retirement/OAuth regressions and supported type/unit/build/integration checks are required; see verification below.

Operational cleanup explicitly requested by Tim: Native test builds workflow was
disabled; all 37 native Actions artifacts and 3 test prereleases (15 release
assets) were deleted and zero remaining artifacts/releases read back. Git source,
history and tags remain. No application deployment, database migration, auth-table
write, user-record deletion or medicine action. Existing stored OAuth rows remain;
retired identities/resources are denied in server policy and cannot become MCP
grants. Standard public CI and active main ruleset 25908933 remain enabled.

The web still uses the generic LiveRefreshQueue in @wuff/client; preserve it while
removing native-only SDK classes. Keep shared UI/domain/contracts used by web/MCP.
Native HTML controls (for example native-select) are browser accessibility controls,
not Tauri code, and remain. Runtime retirement changes require access-control,
OAuth/PKCE/refresh/resource isolation and actual HTTP/MCP verification. No MCP
capability or user data migration is required; supported persisted actions remain
on the existing authorized domain, HTTP and MCP services.

Native APNs/FCM/WNS senders and environment setup are removed. Browser Web Push
continues to use the browser's push service, including Apple/Google/Microsoft
endpoints; these are required for PWAs, not native client support. New device
registration accepts only Web Push subscriptions. Historical native device rows
remain visible/removable but are skipped by both Todo and Totake callbacks and
reported unavailable. No automatic data deletion or native provider request occurs.

## Verification

At source preparation: `pnpm typecheck`, `pnpm test` (204 passing, zero failed or
skipped) and `pnpm build` pass. The native-resource rejection assertion fails on
main's former policy and passes with this change. Retirement units cover denied
identities/audiences/scopes, preserved MCP defaults/opt-in scopes/redirect safety,
and explicit non-cacheable 410 responses. Web Push units cover unchanged payloads
and expired subscriptions, retired registration/delivery and endpoint safety.
Contributor policy still flags retired paths against accidental reintroduction;
new OAuth/retirement policy paths also receive sensitive-change review hints.

The smaller unit count (231 to 204) reflects deletion of native-only app, SDK,
auth and adapter tests with their implementation. Supported account/privacy,
retry, notification and HTTP/MCP outcomes remain covered. Former native-only
mutation segments in product integration suites now exercise actual HTTP/MCP
adapters, including stock Undo, private image reads and app settings.

Final isolated integration, browser, hosted CI and reviewer results are recorded
on [PR #40](https://github.com/timbenniks/wuff-todo/pull/40). Check that record
for current-head evidence before merge. Local provider mocks do not prove live
push delivery; installed-PWA/physical-phone receipt is a separate gate.

Review regressions: legacy image uploads also return the same non-cacheable 410;
a real-browser check discovers Remove controls by accessible name and removes only
its chosen synthetic browser/retired-device records through the authorized API.
The latter fails against the malformed pre-fix label. See PR review replies for
fix commits and passing evidence.

Final local adapter evidence: all 18 relevant cases have passing isolated runs
across dashboard, Empire settings, list nesting, MCP choices, Notes, OAuth,
reminders, Totake actions/callbacks and Web Push suites. The first combined run
was 15/18: older OAuth expectations were corrected to the current disabled-tool
SDK envelope/return URL, and a Web Push run hit managed Auth 429. Subsequent
serial OAuth (3/3) and Web Push (1/1) runs passed after cooldown. The final actual
retirement case includes both private-image methods, stored legacy grants, MCP
PKCE and refresh. Do not present the initial combined run as all-green.

Chrome passed portal/Todo/AI+MCP/notification-settings smoke at 390/1280px; the
real device-removal regression; Totake sign-in/account guards, grouped selection,
15/30/45/60-minute snooze, exact retry, Skip/Undo and stock at 320/390/1280px; and
the full mocked-provider UX phase-five workflow. Its mock PWA now enables Web
Push rather than iOS, and Todo device-management navigation follows global
notification Settings. Provider mocks remain distinct from live device receipt.
