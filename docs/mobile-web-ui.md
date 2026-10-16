# Mobile website layout

Updated: October 16, 2026

The website adapts the existing Wuff palette, typography and Waffles identity for narrow screens. This milestone streamlines the online website; native apps and offline behaviour remain unchanged.

## Interaction decisions

- Below 768px, a compact Wuff header has a Lists disclosure. It reveals the existing list navigation, creation, archive, personal reordering, connections and sign-out controls. Choosing a list closes the disclosure and returns focus to its trigger; Escape also closes it. The desktop sidebar stays visible.
- Revised after the user's screenshot feedback: below 640px, each task/subtask is a single line containing completion, an ellipsized name, an optional inline date and one actions button. The full name is available in the floating action panel. There is no persistent action rail or drag icon below the name.
- The floating panel contains labelled Edit, Notes, Subtasks/progress, Date, Delete and Reorder controls, plus the existing section-move capability where applicable. It overlays the list rather than adding action rows. Outside pointer input and Escape close it. Selecting editing, notes, dates or subtasks closes it. Desktop direct controls remain available.
- Task/subtask rename uses a single line with the name field and compact check/cross buttons on phones. Accessible labels and Enter/Escape remain. Errors/conflict notices can expand below the field so feedback is never clipped. Mobile section moves are available in the action panel; the desktop name form retains its section field.
- Subtasks start collapsed and open explicitly through the parent's action panel. Existing nonempty subtask drafts keep their branch open. Notes and dates open only on request, preserving retained drafts. Editors still use the available width.
- Completion, actions, save and cancel targets remain at least 44px. The rich-text toolbar stays a single scrolling strip with all existing commands. The editor starts at 128px and scrolls beyond 40dvh.
- Existing permissions, confirmation behaviour, versioning, retries, in-memory drafts and Markdown persistence are unchanged. No API, domain, database, OAuth or MCP App changes are included.

## Previous two-line layout verification

- Final `pnpm check` passed: workspace/root TypeScript, all 25 unit tests, optimized Next.js and MCP App builds. Static scanning of 20 browser scripts found no server secrets or domain SQL. No new implementation-mirroring unit tests were added for responsive styling. The backend integration suite was not rerun for this website-only change; historical integration results remain in their milestone documents.
- The optimized local build used a real synthetic development session and a disposable list on the existing isolated Neon branch. At 390px, combined subtask/name and rich-note editing measured a 284px name input, a 348px toolbar and a 128px editor. At 320px, the name input measured 214px. Both widths had `documentElement.scrollWidth === innerWidth`, including open editors.
- Browser actions exercised list disclosure/selection, direct Edit/Notes, inline name save, bold note save/reopen, Escape cancellation, More keyboard access, date saving, focus return to More after saving a hidden date action, and pointer drag through the exposed handle. A separate domain read verified the exact name, bold Markdown, date and reordered roots, with parent/child relationships and completion preserved.
- The 1280px desktop view retained its visible sidebar and direct task controls, without horizontal overflow. [Combined phone editors](screenshots/mobile-streamlined-editing.jpg) use only synthetic development content.
- Responsive browser proof does not certify physical iOS/Android keyboards, touch gestures or screen readers. Keyboard drag activation/cancellation and pointer dragging were exercised; keyboard arrow-based relocation was not established in this milestone.

## Previous two-line layout release

Source `450eea8d18ccb7793c8b01e12846f7b708f9554e` passed [GitHub CI run 38948658330](https://github.com/timbenniks/wuff-todo/actions/runs/38948658330). CLI deployment `dpl_9Y9KSsAdm6Q5QkzENWs3oTya5EAE` is READY in `fra1`, with the canonical [production alias](https://wuff-todo.vercel.app).

An existing signed-in production browser opened a disposable private synthetic list at 390px, saved an inline subtask rename, saved bold notes, and reopened both editors together. Measurements matched the local build: 284px name field, 49px toolbar, 128px editor, and `documentElement.scrollWidth === innerWidth === 390`. A separate server read verified exact saved name/Markdown and unchanged parent/child dates and completion. [Production screenshot](screenshots/mobile-streamlined-production.jpg) contains only the synthetic list, with private list navigation collapsed.

The production fixture was deleted and confirmed inaccessible. The development fixture was also removed and independently confirmed inaccessible; the original baseline fixture was preserved. Test tabs were closed, temporary viewport sizes reset and the local dev server restored. No real task content was edited, no auth-managed tables or database schema were changed, and this fixture created no OAuth grants.

## Single-line revision

The user explicitly preferred one-line task rows and one-line editing over the previous separated action rail and stacked rename form. Historical screenshots and measurements above belong to the superseded two-line layout.

- Final `pnpm check` passed with 25 unit tests, workspace/root TypeScript and optimized web/MCP builds. A subsequent static scan checked 20 browser scripts for server secrets/domain SQL. No domain/API/MCP/schema changes or backend integration rerun are included.
- On the optimized build, 320px and 390px layouts had no document overflow. At 320px the subtask rename input and both icon buttons were 44px high on the same line; the input was 126px wide and both targets 44px wide. Long task names remain one line and are readable in full in the action panel.
- Browser checks covered explicit subtask expansion, compact rename/save/cancel and focus return, rich-note save, date save, section moves in both directions, pointer drag from the action panel and exact persisted ordering. A separate domain read verified the saved name, bold Markdown, date, parent/child relationship and completion state.
- An unsaved child note survived parent completion and reopening with its branch/editor visible. Outside clicks and Escape dismiss the floating panel; panels fit within the viewport with height limits, scrolling and upward placement when needed. Desktop controls remain directly available at 1280px.
- Screenshots use only synthetic data: [single-line rows](screenshots/mobile-single-line.jpg), [single-line rename](screenshots/mobile-single-line-editing.jpg). Physical-device and screen-reader checks remain separate.

### Single-line production release

Source `67086a6d654104d74faa2be80460af8b200ebea9` passed [GitHub CI run 38950652235](https://github.com/timbenniks/wuff-todo/actions/runs/38950652235). CLI deployment `dpl_Adox9ntu3qg4sLd22FV8xXJW5qkY` is READY in `fra1` with the canonical production alias.

The signed-in production browser verified the new collapsed default, one actions button per task, explicit subtask expansion, inline name save, bold note save and reopening. Row completion/title/actions had identical vertical centres. Name input/save/cancel were each 44px high with identical vertical centres. At a 390×500 viewport the action panel opened upward, remained inside the viewport (`top = 12px`) and scrolled its remaining commands. A separate server read verified exact saved name/Markdown, independent dates and unchanged completion. [Live default rows](screenshots/mobile-single-line-production.jpg) and [live rename](screenshots/mobile-single-line-production-editing.jpg) contain only the disposable synthetic list.

The production list was removed and confirmed inaccessible. Development cleanup was independently verified; baseline fixture and real user content were preserved. Successful test tabs were closed, viewport overrides reset and the local dev server restored. This revision created no OAuth grants and changed no database schema or auth-managed tables.
