# Mobile website layout

Updated: October 16, 2026

The website adapts the existing Wuff palette, typography and Waffles identity for narrow screens. This milestone streamlines the online website; native apps and offline behaviour remain unchanged.

## Interaction decisions

- Below 768px, a compact Wuff header has a Lists disclosure. It reveals the existing list navigation, creation, archive, personal reordering, connections and sign-out controls. Choosing a list closes the disclosure and returns focus to its trigger; Escape also closes it. The desktop sidebar stays visible.
- Revised after the user's screenshot feedback: below 640px, each task/subtask is a single line containing completion, an ellipsized name, an optional inline date and one actions button. The full name is available in the floating action panel. There is no persistent action rail or drag icon below the name.
- The floating panel contains icon controls for Edit, Notes, Subtasks/progress, Date, Delete and Reorder, with accessible names and tooltips, plus the existing section-move capability where applicable. It overlays the list rather than adding action rows. Outside pointer input and Escape close it. Selecting editing, notes, dates or subtasks closes it. Desktop direct controls remain available.
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

## Quiet icon controls

The user then explicitly rejected solid-blue buttons and unnecessary button words. Familiar task add/save/cancel, note save/cancel, date save/clear/cancel, list navigation, share, settings and section-add controls use icons with accessible names and native title tooltips. The floating phone action panel uses one compact icon strip; full task names and section fields remain readable. Today/Tomorrow choices, destructive confirmations and recovery instructions retain meaningful words.

The shared default button is neutral white with a light border; routine icon actions use transparent ghost buttons. Explicit destructive styling stays distinct. Input focus uses a compact one-pixel outline/border treatment, and task add inputs are 44px high. Icon touch targets retain the existing 44px phone sizing. No contract, database, MCP or offline change is included.

- `pnpm check` passed with all 25 unit tests, TypeScript and optimized web/MCP builds. A final optimized build was repeated after the icon-colour refinement. Browser script scanning passed. The backend integration suite was not rerun for these presentation changes.
- On the optimized local build, icon buttons created a task, subtask and section, saved a task rename and bold notes, saved a custom date and cleared it. A separate domain read verified exact values and preserved parent dates/completion. Sharing/settings opened from their icon triggers without changing access.
- At 320px, save/cancel/add targets measured 44×44px with transparent computed backgrounds and no document overflow. At 390px all six task actions shared the same vertical position in one icon strip. The 1280px desktop view also had no horizontal overflow. [Quiet controls](screenshots/mobile-quiet-controls.jpg) use only synthetic data.
- The first optimized local navigation used an older fixture cookie and failed in the managed SDK's server-component cookie update; a fresh synthetic sign-in passed. No authentication fix or production authentication regression is claimed by this UI milestone.

### Quiet controls production release

Source `404353f38c9e54f3e77d2529411d5d17151f1f5f` passed [GitHub CI run 38952060440](https://github.com/timbenniks/wuff-todo/actions/runs/38952060440). CLI deployment `dpl_BZ94rys69Gom6hKk1V5xXX2jJhzo` is READY in `fra1` with the canonical production alias.

The signed-in production browser saved a subtask rename and bold notes through the icon buttons, then reopened the compact name field. Save, cancel and task/subtask add controls measured 44×44px with transparent backgrounds. At 390px there was no document overflow. A separate server read verified exact text/Markdown and preserved dates/completion. [Production quiet controls](screenshots/mobile-quiet-production.jpg) contains only synthetic data.

Disposable production/development lists were removed and confirmed inaccessible. The baseline fixture and real lists were preserved, viewport overrides reset, test tabs closed and the local dev server restored. No schema/auth-managed-table changes or OAuth grants were involved. Physical-device and screen-reader verification remain separate.

## Shared form foundation — October 16, 2026

The previous controls used a shadcn-style Button but raw inputs styled by global element selectors. Those selectors imposed padding, borders and an offset focus outline, with phone-only overrides. This did not provide a consistent form foundation and produced the double frame shown in the user's screenshot.

Visible website inputs now use shared `Input`, `Textarea`, and `NativeSelect` components. Add-list, add-task, add-subtask, add-section and inline-name forms compose `InputGroupInput` with trailing `InputGroupButton` actions inside one field. The shared Input and InputGroup source was copied from the official shadcn new-york-v4 registry and adapted to Wuff's existing palette, a single 1px focus ring, and 44px touch targets. Textarea and the simple native select follow the same local tokens; the radio color choices and hidden image file picker remain native. `apps/web/components.json` records the registry configuration. No form-state library or new runtime dependency was required.

Remove the global input/textarea/select presentation rules; component classes now own height, padding, border and focus. Inline names use the same 16px field at every viewport, including list headings, while the saved heading retains its display typography. Task action buttons disappear during rename so the field gets available width. Labels, accessible action names, Enter/Escape handling, validation, drafts and stale-edit notices are preserved. Auxiliary section selection remains beneath desktop rename fields and in the phone action disclosure.

Sources consulted: [shadcn Input](https://ui.shadcn.com/docs/components/input) and [Input Group](https://ui.shadcn.com/docs/components/input-group), plus their official new-york-v4 registry source. This does not claim the entire UI has been converted to shadcn; existing dialogs, completion controls and the Tiptap editor remain their existing implementations.

### Verification

- Local TypeScript checks, all 25 unit tests and the optimized Next.js/MCP build passed. The final optimized build also passed after the explicit create-list submit-button refinement.
- Real synthetic development browser checks: task rename with Enter; task/subtask/section creation; blank-name validation preserving the editor; Escape cancellation; settings textarea rendering. Viewport/document widths matched at 320, 390, 640 and 1280px. Inline icon targets measured 44×44px; grouped field height measured 44px, with a borderless input and a single group focus ring.
- Optimized-build browser checks also saved a custom date and created a list through its grouped submit icon. A separate domain read confirmed the saved task/subtask names, section and date, then removed the disposable UI-created list. A static browser-bundle scan checked 20 scripts without finding server secrets or domain SQL.
- Screenshot: [mobile grouped fields](screenshots/forms-mobile-editing.jpg). This initial screenshot is from local development with synthetic data.
- No database schema, permissions, authentication flow, API/MCP contract or mutation service changed. Backend integration results from prior milestones are historical; they were not rerun for this form refactor. Physical-device and screen-reader verification remain separate.
