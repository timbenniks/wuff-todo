# Full-width app workspaces

October 25, 2026. Follow-up to sidebar alignment: Tim prefers Todo's full-width
desktop canvas and finds the repeated Empire/sidebar logos distracting.
Root AGENTS.md and the contributor skill/design/accessibility/surface guides apply.

Acceptance:

- [x] Web Todo and Totake sidebars use text-only app headings; Empire keeps Waffles.
- [x] Totake fills the desktop canvas with Todo's 28px gutters, 36px on wide screens.
- [x] 320/390px phone menus, keyboard dismissal and focus recovery still work.
- [x] Native Todo keeps its own logo because it has no Empire header.

Presentation only: preserve destinations, app functions, independent scrolling,
the 260px navigation rail, selected states and standalone Settings. No persisted
data, API/MCP contract, connection/consent, schema, permission, dependency or
production configuration changes. MCP App UI is unaffected. Style-only work needs
browser geometry/interaction evidence, not unit tests asserting copy/CSS classes.
Run pnpm typecheck, pnpm test, pnpm build and Chrome checks at 320/390/1280/1920px.
No production or unverified-preview writes. Tim reviews and merges the draft PR.

## Verification

- `pnpm typecheck`: all workspaces and root passed, including native TypeScript.
- `pnpm test`: 156 tests passed, zero skips.
- `pnpm build`: guide, MCP and optimized web build passed.
- Actual Chrome against the optimized local app, with an existing synthetic
  account on the isolated development branch: at 1280px both content regions
  span x=260..1280 with 28px left/right gutters; at 1920px both span
  x=260..1920 (1660px wide) with 36px gutters. No horizontal document overflow.
- Both web sidebars contain no logo image. Text headings and the Empire mascot
  remain; the native-only Todo mascot branch is retained in source. No installed
  native/device verification is claimed.
- Both apps' 320/390px menus open, close with Escape and restore focus to Lists/
  Totake menu, with no horizontal document overflow. Captured browser errors: none.
- Screenshots: `docs/screenshots/full-width-{todo,totake}-1280.png`. No clinical
  fixtures, production writes, provider sends or preview writes. No behavior unit
  tests added for these static style changes; existing interaction handlers remain.

Remote checks/preview status are recorded in the PR. Existing GitHub billing
limits may block runners; blocked checks are not passing code verification.
