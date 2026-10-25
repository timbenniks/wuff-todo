# App sidebar alignment

October 25, 2026. Align Todo and Totake navigation within the existing Empire
shell. Root AGENTS.md, the contributor skill and guide design/accessibility and
surface rules apply; apps/web/AGENTS.md applies to web files if touched.

Use Todo's existing 260px desktop rail, Waffles/wordmark heading, 44px icon/text
rows, surface selected state and bottom Settings utility as the common language.
Preserve Todo list favorites, ordering, archive, account actions and palettes.
Keep Totake's three destinations and its logo-to-Empire destination. On phones,
match the brand/menu row and navigation dialog treatment. Keep keyboard dismissal
and focus recovery. Top-align Totake content rather than vertically centering it.

Acceptance:

- [x] Both desktop sidebars share width, brand sizing, row alignment and active styling.
- [x] Totake has a bottom Settings shortcut and keeps all existing destinations.
- [x] Both mobile brand/menu rows fit at 320px and 390px; menus close and restore focus.
- [x] Long navigation labels wrap without horizontal document overflow.
- [x] Todo list selection, favorites, archive and selected-list colors retain their existing handlers and structure.

This is presentation/navigation composition only. No persisted data, domain/API/
MCP contracts, grants, consent, providers, schema, dependencies or permissions
change. MCP App UI is unaffected. Shared Todo styling also reaches the native
frontend; installed native verification is separate. No production write or
deployment is requested.

Verification plan: pnpm typecheck, pnpm test, optimized build and local browser
checks at 320/390/1280px, desktop selected states, mobile open/select/close/Escape
and focus restoration. No new unit tests for static styles or copy; interaction
evidence belongs in browser verification. Results will be recorded here.

## Verification

- `pnpm typecheck` passed for all workspaces and root scripts/tests.
- `pnpm test` passed: 156 tests, zero skips. No behavior tests added for static
  presentation; no domain/adaptor implementation changed.
- `pnpm build` passed, including guide generation, MCP and optimized Next.js.
  Rebuilt after the final desktop scrolling CSS change.
- Actual Chrome checks against the optimized local app with an existing synthetic
  development account: 1280x900 desktop and 320x850/390x850 phone viewports.
  Both desktop rails measure 260px, both brands start at y=92 and the first
  navigation row at y=160, with 44px height and the same selected background.
  Totake content scrolls independently so its sidebar/Settings remain visible.
- Todo and Totake mobile menu open/Escape/focus recovery passed; choosing a Todo
  list or Totake Notification settings closes the menu and focuses the trigger.
  Totake's narrow menu rows measure 44px high; no horizontal document overflow.
  Verified Totake items selected state, Settings link handoff and embedded
  `/settings/totake` retaining the standalone Settings navigation without another
  visible sidebar. Captured browser error log was empty.
- Screenshots: `docs/screenshots/sidebar-{todo,totake}-1280.png`, each app's
  `-320.png`, and `sidebar-{todo,totake}-menu-{320,390}.png`.
  Images contain development fixtures only. No production writes, provider sends,
  new clinical fixtures or preview writes were performed.

Review limits: no physical phone, installed native app, screen reader, drag reorder
or populated-favorites exercise. Todo favorites/reorder/palette logic is untouched.
The empty Archive control returned to Overview during the local check; its
existing handler calls `chooseList("")`, which clears archive mode. Those handlers
are unchanged in this PR; this separate behavior is not counted as a passing
archive interaction test. Remote CI and preview status are recorded in the PR.
