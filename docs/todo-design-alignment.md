# Todo visual alignment with Totake

October 25, 2026. Tim wants Totake's recently created design respected and used
as a reference for a modest Todo styling pass. Do not redesign Totake.

Root AGENTS.md, contributor workflow/skill and guide product, design, accessibility
and surface requirements apply. Source changes are confined to Todo's shared UI.

Acceptance:

- [ ] Todo desktop titles adopt Totake's 30px heading scale and tighter tracking.
- [ ] Todo overview uses 12px cards, 20px gaps and quieter undivided card headings.
- [ ] Todo settings dialogs adopt Totake's 18px dialog titles, quiet header borders
  and 20px content padding, retaining explicit Save/Cancel and personal/shared cues.
- [ ] Mobile task headings, 44px targets, list navigation, task-row density,
  selected-list palettes and all existing actions/recovery remain intact.
- [ ] Totake source and behavior remain unchanged.

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
