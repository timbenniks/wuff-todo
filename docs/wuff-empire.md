# Wuff Empire portal

October 25, 2026. Implemented and verified locally; no production release claimed.

## Feature brief

Wuff Empire is the shared entry point for the family's apps. `/` opens a personal
dashboard; the persistent top navigation opens Dashboard, Wuff Todo (`/lists`),
Wuff Totake (`/totake`, coming soon), and account settings/sign-out. Todo retains
its list sidebar and its existing Home as Overview. Existing list/task URLs and
Todo's saved overview/startup preferences keep their meanings. Native Todo keeps
its current navigation and branding.

The portal has app cards and read-only Todo Today/Coming up/Favorites previews.
Task/list links open the existing Todo views. Totake has no medication data,
scheduling, permissions or delivery implementation in this feature. The portal is
shared infrastructure, not shared visibility into another person's private data.

Active instructions: root AGENTS.md, apps/web/AGENTS.md, wuff-contributor skill,
contributor workflow, product/architecture and guide design/accessibility/surface
rules. Reuse DM Sans, Waffles, Blue semantic tokens and existing controls. The
signature is a compact Waffles welcome beside the app launcher; no new font,
dependency, database or separate deployment is needed.

## Acceptance and verification plan

- [x] `/` is an admitted-account portal with no Todo sidebar or last-list redirect.
- [x] Global desktop/mobile navigation reaches Todo, Totake and account settings;
      logo returns to the portal; active state and keyboard dismissal are correct.
- [x] Todo retains explicit list/task URLs, history and saved views; native's
      original navigation branch remains and its frontend build passes. Installed
      native acceptance remains separate.
- [x] Todo previews reuse the authorized dashboard endpoint, browser-local calendar
      date and bounded previews; loading/empty/failure/retry/reconnect are explicit.
- [x] Account-pinned requests reject account changes, revoked shared content
      disappears on refresh, failures clear previews, and late reads cannot restore them.
- [x] Existing Todo overview section preferences control the reused previews.
- [x] Sign-in defaults to the portal and preserves supported direct destinations.
- [x] Unit tests cover route classification/return safety and preview selection;
      browser checks cover 320/390/1280px, overflow, focus, links, recovery and privacy.
- [x] Typecheck, unit tests, optimized web/MCP and native frontend builds pass.

## API, MCP, connections and privacy

No persisted-data changes. Read-only portal sections consume existing
`getDashboard` / `GET /api/v1/dashboard` / MCP `get_dashboard` and `show_dashboard`.
Existing Todo preferences and mutation surfaces are unchanged. The portal adds
navigation rather than a new MCP workflow; the existing MCP dashboard remains the
equivalent visual/read capability. No new scopes, grants or provider connections;
existing list permissions/admission and account-pinned API requests apply. Future
Totake must define separate permissions/consent and never inherit access from a
Todo connection. No auth schema, native permissions or infrastructure changes.

## Delivery

Branch `codex/wuff-empire-portal`; [draft PR #25](https://github.com/timbenniks/wuff-todo/pull/25).
Verification commands and limits are recorded in `docs/verification.md`. Existing local
edits to package.json, pnpm-lock.yaml and pnpm-workspace.yaml are outside this
feature and must not be committed. Preview isolation is not assumed. Verification
uses synthetic isolated-development data after readiness checks; production,
installed devices and named MCP hosts remain separate gates.

The header is web-only; its height is subtracted from Todo's desktop workspace.
Public guides and authorization pages keep their independent layouts. Sign-in,
password setup and the web manifest use the Empire name; the manifest launches
`/`, with no offline-cache change. Todo's stored `home`/`last_list` values, URLs,
domain contracts and native identity remain compatible. Portal previews refresh
on focus/visibility/reconnect and every ten seconds, with last-request-wins
arbitration and cleared data on failure. Long preview titles show at most two
lines; the full title remains the link's accessible name and opens task details.

GitHub's initial `check` and `policy` jobs did not start because of account
payment/spending limits (confirmed from run annotations October 25). Keep this PR
draft until remote checks and review gates can be completed; local success does
not satisfy those checks. Preview backend isolation is unconfirmed, so no preview
data writes or production deployment are claimed.
