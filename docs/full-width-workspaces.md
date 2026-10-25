# Full-width app workspaces

October 25, 2026. Follow-up to sidebar alignment: Tim prefers Todo's full-width
desktop canvas and finds the repeated Empire/sidebar logos distracting.
Root AGENTS.md and the contributor skill/design/accessibility/surface guides apply.

Acceptance:

- [ ] Web Todo and Totake sidebars use text-only app headings; Empire keeps Waffles.
- [ ] Totake fills the desktop canvas with Todo's 28px gutters, 36px on wide screens.
- [ ] 320/390px phone menus, keyboard dismissal and focus recovery still work.
- [ ] Native Todo keeps its own logo because it has no Empire header.

Presentation only: preserve destinations, app functions, independent scrolling,
the 260px navigation rail, selected states and standalone Settings. No persisted
data, API/MCP contract, connection/consent, schema, permission, dependency or
production configuration changes. MCP App UI is unaffected. Style-only work needs
browser geometry/interaction evidence, not unit tests asserting copy/CSS classes.
Run pnpm typecheck, pnpm test, pnpm build and Chrome checks at 320/390/1280/1920px.
No production or unverified-preview writes. Tim reviews and merges the draft PR.
