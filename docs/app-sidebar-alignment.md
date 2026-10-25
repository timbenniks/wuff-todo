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

- [ ] Both desktop sidebars share width, brand sizing, row alignment and active styling.
- [ ] Totake has a bottom Settings shortcut and keeps all existing destinations.
- [ ] Both mobile brand/menu rows fit at 320px and 390px; menus close and restore focus.
- [ ] Long navigation labels wrap without horizontal document overflow.
- [ ] Todo list selection, favorites, archive and selected-list colors remain intact.

This is presentation/navigation composition only. No persisted data, domain/API/
MCP contracts, grants, consent, providers, schema, dependencies or permissions
change. MCP App UI is unaffected. Shared Todo styling also reaches the native
frontend; installed native verification is separate. No production write or
deployment is requested.

Verification plan: pnpm typecheck, pnpm test, optimized build and local browser
checks at 320/390/1280px, desktop selected states, mobile open/select/close/Escape
and focus restoration. No new unit tests for static styles or copy; interaction
evidence belongs in browser verification. Results will be recorded here.
