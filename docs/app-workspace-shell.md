# App workspace and navigation

October 24, 2026. Wishlist WUFF-120, WUFF-121, WUFF-122 and WUFF-123.

Superseded account layout, October 25: [Empire Settings](empire-settings.md) now
uses an independent settings navigation, rather than Todo's sidebar. Todo keeps
its own list UI and creation/retry behavior. The original acceptance/evidence
below describes the earlier milestone; the current settings contract takes
precedence for account pages.

October 25 extension: [Wuff Empire](wuff-empire.md) adds a shared web header above
this workspace. Its logo goes to `/`; Todo's sidebar logo stays inside Todo's
Overview (`/lists?home=1`). Desktop height subtracts the global header so existing
independent scrolling survives. Native retains the original shell and Home label.

## Scope and acceptance

1. Logo and wordmark are a single accessible Home link. Ordinary activation inside
   Lists uses existing selection state, uses the existing list cache and selects
   explicit Home regardless of the saved last-list preference. Modified clicks
   retain normal link behavior. Settings and guide logos also point to Home.
2. Account Settings fills the existing app workspace. Reuse ListApp's actual
   personal list tree, favorites, archive, account controls, live refresh and mobile
   Lists dialog. Settings destinations appear beneath Settings in that sidebar.
   Existing provider, connection and reminder forms retain their behavior.
3. Docs is available at `/settings/docs` with seven guide pages, page selection,
   palette preview, component examples/search and downloads in the same shell.
   Public `/docs`, `/docs/agent-context.md` and contributor downloads remain public
   and contain only synthetic examples. Private sidebar data requires an enabled
   signed-in account. Existing routes and public links stay valid.
4. Desktop list header and 48px sidebar brand share a vertical center. Preserve
   sticky title/View behavior, readable truncated titles and existing phone layout.

WUFF-80 is explicitly deferred. No reminder implementation, schema, domain/API or
MCP contract changes are included. Installed native Settings continue opening the
hosted web settings; the shared native list UI receives the logo/alignment fix.

## Design and implementation

Keep Wuff's DM Sans, existing list palettes, Waffles and quiet compact controls.
The desktop remains a 260px sidebar plus fluid independently scrolling content;
phones retain the existing labeled Lists sheet and 44px targets. Use the same
ListApp with a server-rendered account-content/navigation slot rather than a
second sidebar implementation. From an account page, list/Home selection opens
its explicit existing URL. List creation keeps its pending operation in the
existing modal until confirmed and retries the same operation after response loss.

Settings owns its nested guide routes and reuses the public article, controls and
resources. Only the controls' base path changes; public assets and agent references
keep their public URLs. Account authorization runs before loading sidebar lists.
Desktop main top padding is 14px: its 60px title rail centers at y44, matching the
sidebar's 20px top padding plus half its 48px brand. Sticky offsets follow that
padding at both desktop breakpoints.

## Verification and release

Local checks passed: workspace/root TypeScript, 91 unit tests, optimized web/MCP
and native frontend builds. The optimized browser harness verifies mouse/keyboard
Home, history, Settings/Docs active navigation, desktop geometry and independent
scrolling, 320/390px navigation/focus/overflow, guide controls/resources, anonymous
boundaries and creation response-loss recovery using disposable development data.
Existing list-workspace and Phase 6 browser regressions also pass. See the
[verification record](verification.md#wishlist-app-workspace--october-24-2026).

Source push and local browser evidence are separate from production verification
and installed native/device/accessibility testing. Record results in
`docs/verification.md` and task notes before changing completion status.
