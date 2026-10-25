# Wuff Empire portal

October 25, 2026. Implementation in progress; no production release claimed.

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

- [ ] `/` is an admitted-account portal with no Todo sidebar or last-list redirect.
- [ ] Global desktop/mobile navigation reaches Todo, Totake and account settings;
      logo returns to the portal; active state and keyboard dismissal are correct.
- [ ] Todo retains explicit list/task URLs, history, saved views and native behavior.
- [ ] Todo previews reuse the authorized dashboard endpoint, browser-local calendar
      date and bounded previews; loading/empty/failure/retry/reconnect are explicit.
- [ ] No private preview survives an account/access change or failed refresh.
- [ ] Existing Todo overview section preferences control the reused previews.
- [ ] Sign-in defaults to the portal and preserves supported direct destinations.
- [ ] Unit tests cover route classification/return safety and preview selection;
      browser checks cover 320/390/1280px, overflow, focus, links, recovery and privacy.
- [ ] Typecheck, unit tests, optimized web/MCP and native frontend builds pass.

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

Branch `codex/wuff-empire-portal`; draft PR and evidence to follow. Existing local
edits to package.json, pnpm-lock.yaml and pnpm-workspace.yaml are outside this
feature and must not be committed. Preview isolation is not assumed. Verification
uses synthetic isolated-development data after readiness checks; production,
installed devices and named MCP hosts remain separate gates.
