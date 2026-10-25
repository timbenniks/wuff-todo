# Todo visual alignment with Totake

October 25, 2026. Tim wants Totake's recently created design respected and used
as a reference for a modest Todo styling pass. Do not redesign Totake.

Root AGENTS.md, contributor workflow/skill and guide product, design, accessibility
and surface requirements apply. Source changes are confined to Todo's shared UI.

Acceptance:

- [x] Todo desktop titles adopt Totake's 30px/700 heading scale and tighter tracking.
- [x] Todo overview uses 12px cards, 20px gaps and quieter undivided card headings.
- [x] Todo settings dialogs adopt Totake's 18px dialog titles, quiet header borders
      and 20px content padding, retaining existing Save/Cancel or Close actions and personal/shared cues.
- [x] Mobile task headings, 44px targets, list navigation, task-row density,
      selected-list palettes and all existing actions/recovery remain intact.
- [x] Totake source and behavior remain unchanged.

No persisted-data, domain/API/MCP, connection/scopes/consent, schema, dependency,
native permission, notification or production configuration changes. MCP UI does
not use these React screens; no MCP adapter change is needed. Shared Todo styles
also reach the native frontend, but installed native evidence is separate.

Unit plan: presentation-only changes do not need tests asserting copy/CSS classes.
Run existing pnpm typecheck/test/build and actual optimized Chrome checks with
synthetic development data: overview, a populated list, settings open/Cancel/
Escape/focus, retained draft, phone menus at 320/390px and desktop at 1280px.
Check default and another saved palette if available, long titles/notes and both
row densities without changing production. No preview writes without isolation.

## Verification

- `pnpm typecheck`: all workspaces and root passed, including native TypeScript.
- `pnpm test`: 156 tests passed, zero skips. This change adds presentation hooks
  and styles only; no tests assert static copy or CSS class names.
- `pnpm build`: guide, MCP and optimized web passed. Rebuilt after final title
  weight correction and rechecked the affected desktop/phone views.
- Prettier and `git diff --check` passed. No Totake file differs from main.
- Actual Chrome on optimized localhost with existing synthetic development
  session: Blue overview/list settings plus a disposable Lavender long-title list.
  Desktop titles match Totake at 30px/700, cards measure 12px corners/20px gaps,
  settings 560px wide with 18px title/20px padding and no heavy shadow.
- At 320/390px, long list titles stay within the heading rail at 20px, overview
  titles remain 22px, no horizontal document overflow. Compact row padding is 4px,
  Comfortable 12px; completion targets remain 44px. Narrow settings measure 296px
  at 320px, with equal scroll/client width and no horizontal overflow.
- Overview checkbox changes followed by Cancel are discarded on reopening.
  Unsaved list-name draft survives switching settings pages, while the saved
  heading remains unchanged. Escape restores trigger focus for both settings
  dialogs and the phone Lists menu; Shift+Tab wraps within the settings dialog.
- Captured console error log empty. No production/preview writes or provider sends.
  The disposable long-title list and its three fictional tasks were deleted after
  review; existing lists/settings were not saved or modified. Row-density changes
  remained unsaved and reverted on reload.
- Screenshots `docs/screenshots/todo-alignment-*` show overview, populated list
  and settings at desktop/phone sizes, using synthetic data only.

No physical phone, installed native app, screen reader, drag reorder, denied/
offline/conflict or provider integration exercise is claimed. Existing domain,
API/MCP and request/recovery handlers are unchanged. Remote checks and preview
status are recorded in the draft PR; blocked checks remain incomplete.
