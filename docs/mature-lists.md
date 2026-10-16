# Mature lists

Confirmed October 16, 2026: improve lists before native mobile. This build covers personal sidebar order, shared list colors, a list description, sections, and archive/restore. Richer task content (Markdown and private image uploads), subtasks, and deadlines are subsequent milestones, not part of this build.

## Behavior and ownership

- Sidebar ordering belongs to each account, persists across sessions, and includes both owned and shared lists. Changing it never changes another member's sidebar or the shared task order. Newly accessible lists append in creation order. Inaccessible/deleted lists are filtered out. Reorder controls work with keyboard, touch, and pointer.
- The owner chooses a shared color from a named, accessible palette. The website and MCP App show the same color. Color is an accent, never the only label or a reason to reduce text contrast. Cover images and arbitrary custom hex colors are separate future work.
- The owner edits the list name and a plain-text description (up to 4,000 characters). The description provides context above the tasks; rich task content follows separately.
- Sections are named, ordered, collapsible groups within one list, not separate lists with different sharing. Only the owner creates/renames/reorders/removes sections. Members can add or move tasks between sections. Removing a section keeps its tasks in the unsectioned group. Up to 50 sections per list; tasks can also remain unsectioned. Existing tasks remain unsectioned during migration.
- The owner archives/restores the list for everyone. Archived lists remain accessible in an Archive view and retain tasks, sections, membership, and description. Task and section writes are rejected while archived; sharing and owner metadata management remain available. Permanent deletion keeps its existing explicit confirmation.
- All shared mutations use existing list versioning and operation receipts. Personal ordering has its own account revision and receipt, avoiding conflicts with task edits. Every HTTP/MCP path uses the same domain checks.
- Live query signals include metadata, archive status, and personal order revisions. Existing authorized reconciliation, draft preservation, and polling fallback remain in place. Offline/native behavior is unchanged.

## Design direction

Preserve Waffles, the current rounded layout, Trebuchet headings, and Avenir/system body text. Use a quiet tinted list header, a matching sidebar marker, and a labeled color picker; keep task surfaces neutral. Palette accents: blue `#315f9b`, lavender `#7355a3`, sage `#34705a`, rose `#a23f66`, peach `#a5502c`, sand `#826619`, slate `#526779`. Settings use one accessible modal with focused fields; sections use familiar disclosure controls and explicit move buttons.

## Implementation and verification

Additive Drizzle migration only, first isolated development then production using direct connections. Defaults preserve existing list contents and colors. Do not modify auth-managed tables or provision a different Neon project.

Verify owner/editor/outsider permissions, personal order isolation and stale revisions, idempotent retries, task/section foreign-list rejection, section deletion preserving tasks, archived write rejection and restore, live catalog changes, HTTP origin/account checks, MCP catalog and operations, keyboard controls, draft preservation, and small-screen layout. Record actual results and production boundaries after implementation.

## Verification evidence — October 16

- `pnpm check` passed: workspace/root TypeScript, 12 unit tests, and optimized Next.js/MCP App builds.
- `pnpm test:integration` passed all 13 development tests. New cases exercise owner/editor/unadmitted/read-only permissions, identical retries, concurrent settings and personal order revisions, section ordering, foreign-list rejection, preservation of completed/active tasks after section removal, archived write denial and restore, access-filtered personal order, and live color/archive/order signals.
- Authenticated OAuth/MCP and HTTP adapters exercised all seven new tools, task section movement, archive/restore, Origin rejection, and old-account rejection. The catalog contains 25 tools.
- Browser QA with synthetic accounts verified saved description/color, section creation, task creation/movement, personal sidebar reordering, and settings Escape/focus restoration. Actual MCP App bridge calls changed color, added a section, and archived the open web list. Live reconciliation preserved an unfinished web task draft on the color/section changes; website restore enabled editing again.
- The local MCP host uses a restricted `allow-scripts` sandbox. Native form submission was blocked there; App forms now use validated explicit click/Enter handlers. Save and section creation passed in that sandbox. This is a local SDK host check, not actual ChatGPT rendering.
- Final optimized-build Chrome checks measured a 390px viewport and 390px document width; the settings dialog fit without horizontal overflow. In-app-browser viewport overrides were ineffective, so phone checks used Chrome. This does not certify a physical device.
- Heavy synthetic auth testing briefly returned HTTP 429; failed session reads remained visible and recovered. Auth protections were preserved. A stale development stylesheet after an overlapping build was resolved by checking the optimized server separately; final header spacing and mobile selectors were visually verified.
- All 17 production static JavaScript files were checked for the actual database/cookie/Realtime secrets and domain SQL; none was present.
- Migration `0002_worried_freak.sql` applied to isolated development and then the Vercel-managed production branch using direct connections. Production list/task/membership counts were unchanged. No auth-managed table was modified.

Saved synthetic screenshots: [desktop](screenshots/mature-list-desktop.jpg), [phone width](screenshots/mature-list-mobile.jpg), [color settings](screenshots/list-color-settings.jpg).

Production deployment and smoke evidence will be recorded after release. Joreel’s independent session, actual ChatGPT, other named hosts, and physical mobile devices remain unverified. The saved Codex grant still needs reauthentication as recorded in [MCP validation](mcp-validation.md#connection-status--october-16-2026).
