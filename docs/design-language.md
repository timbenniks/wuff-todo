# Shared design language and list themes

Date: October 17, 2026

Implements the [design-language audit](design-language-audit.md), with the user's additional request that the list's chosen color theme the entire app. This supersedes the earlier blanket preference for quiet controls: utility actions remain quiet, while primary and form-submit actions have explicit emphasis and labels.

## Behavior and visual contract

- Primary actions use a filled theme color, secondary actions use a bordered surface, utilities stay transparent, and destructive actions are visibly distinct. Button defaults remain secondary so existing miscellaneous actions do not silently become primary.
- Save/Cancel in settings, notes, dates and work details use readable words. Inline rename retains its compact icon controls, Enter/Escape and focus restoration. Sharing and list settings have visible labels; list Delete is labeled and separated.
- Workflow and due dates use non-interactive tags. Tags stay outside the tab order. Date tags retain native `time` semantics and full accessible descriptions; phone row date indicators remain compact, while task-detail dates retain visible text. Semantic blocked/overdue red, review violet and done green remain recognizable across themes.
- List descriptions live inside the identity header. The view disclosure and count/context are compact; named sections combine their heading/actions with an explicit Show/Hide count control. Capture has a visible label and filled Add action. Task completion, first-line title and utility controls share a 44px alignment track; due/work metadata aligns beneath the name.
- Task detail uses a smaller navigation/companion row, closely grouped identity/key/title, separate state and action bands, and consistent panel padding. Saving/copied/saved feedback appears in one temporary accessible toast without reserving an empty header line.
- Task deletion always offers an explicit irreversible-action confirmation, including childless tasks and MCP tasks. Cancel preserves the task. Cascading-delete language still names subtasks. This does not implement Undo or change deletion semantics on the server.
- Existing direct drag controls remain. Clicking a web drag handle opens a position picker using the same authorized reorder callback; pointer and keyboard dragging remain available. A changed item order disables a stale picker. MCP subtask Move also offers a position select alongside its existing drag/keyboard paths; catalog/section movement already uses explicit controls.
- MCP tasks group secondary editing under one compact Task details disclosure. Key, workflow, due date and deletion remain visible; notes and subtask progress are summarized outside the editor. Open state and retained parent/child drafts survive tool-result refreshes.
- Selecting lists updates the authorized list reference in the URL, preserving reload and browser Back/Forward context. No task data is stored offline. Connected-client errors have a visible retry action.

## Typography

DM Sans is the user-selected shared family for web and MCP, including true italics for notes. Font files are local, licensed assets; web uses next/font/local and MCP embeds the same files. Code remains monospace. See [typography review](typography-review.md) for selection, delivery and local verification.

## Theme scope

The selected accessible list is authoritative. Blue, Lavender, Sage, Rose, Peach, Sand and Slate remain owner-controlled, shared list properties. Saving a list color updates the selected app through the existing snapshot/live-refresh path. The settings draft does not preview or save implicitly.

Each accent derives ten opaque sRGB roles in `apps/web/src/lib/list-theme.ts`: primary, primary hover, page, panel, sidebar, accent surface, foreground, muted text/icon, divider and control boundary. Web and MCP use the same derivation and shared CSS for controls/tags. Text, borders, inputs, rich notes, menus, focus rings, sidebar and task details inherit that palette. Other sidebar list markers retain their own list colors so users can identify them.

The web's selected list and task page apply tokens both to their rendered container and to the document root, including page gutters and native dialogs. Leaving that context resets to Blue; auth/connections and the MCP list catalog use Blue because no list is selected. Theme choice adds no account preference, storage, cookie or offline state. Waffles' artwork and semantic danger/success/review colors are preserved. Arbitrary colors, dark mode and native themes are not introduced.

Theme surface/text/control pairs are deliberately separate: subdued dividers do not substitute for sufficiently contrasting interactive boundaries. Explicit generated hex values keep web/MCP consistent without depending on relative-color browser support.

## Implementation boundaries

No dependency, database migration, API/MCP tool, scope, permission or domain contract changed. Existing operation IDs, version checks, draft retention, private attachments and owner/editor boundaries remain in place. The shared standalone MCP stylesheet replaces its inline build-time stylesheet; this avoids loading React into the MCP App solely for appearance.

## Verification

Screenshots use synthetic development data only; the original audit specimen remains a proposal artifact and is not deployment proof.

- Final `pnpm check` passed: workspace/root TypeScript, all 36 unit tests, the optimized Next.js production build and standalone MCP bundle. Two new tests check all seven palettes' text/control contrast and verify that switching palettes changes every structural color role.
- `pnpm test:integration` passed all 21 development cases, including permissions, concurrent writes, idempotency, OAuth/MCP, live access revocation, personal views, subtasks, notes, images and work metadata. No domain/API contract changed in the subsequent MCP disclosure refinement; its fresh TypeScript/build and browser checks passed separately and in the final check.
- Static scanning of 23 optimized browser/MCP files found no matches for the selected server-secret values from ignored environment files or domain SQL markers. Values were never printed. This is a bounded bundle check, not a security certification.
- Synthetic Chrome checks exercised all seven selected-list palettes and a persisted Settings color save. Page, sidebar, controls and text changed with the selected color. Web list/task layouts fit 320, 390, 640, 768, 1024 and 1440 CSS px without horizontal document overflow. Visible task completion, More, Delete and drag targets measured at least 44×44px. Desktop first-line title/completion/action centers were asserted within 2px.
- Browser flows covered task capture, Enter rename, Escape cancellation/focus restoration, pointer position picking with a fresh API order read, Space/arrow/Space keyboard dragging, childless-delete confirmation/cancel, section capture/collapse/reload, and list selection/Back/reload. The 320px review caught a narrow section title; the final responsive heading uses its own readable line and was checked again.
- Task-detail notes, workflow and calendar-date saves were checked in the browser and independently reread through the authorized API. Rose styling carried into the detail page and editor. Reduced-motion feedback styling was checked.
- The sign-in page's primary action and 390px layout were inspected without submitting real credentials. A simulated connections-read 503 exposed Retry; removing the simulation and retrying produced a real successful read. Password activation/mailbox delivery was not rerun by this design change.
- The local MCP Apps SDK host loaded the final standalone bundle and called the real development MCP server. At 320px and 600px document widths there was no horizontal overflow, and the Rose page/control palette matched the web. Capture, notes save, deletion/cancel/confirmation and fresh API reads passed. The grouped-details refinement additionally retained an unsaved note through a subtask creation/tool refresh; cancellation left the previously saved note unchanged, and the new subtask was independently reread.
- Browser evidence came from focused probes rather than a single uninterrupted browser suite. Repeated authenticated probes encountered development-service throttling; focused checks resumed after backing off. A long-lived fixture grant expired during the review, so final MCP checks used a fresh synthetic fixture/grant. No auth workaround or production change was introduced.
- All disposable review lists were removed. Fresh API/domain reads confirmed deletion, including a final domain 404 after grouped-UI verification. Fixture shutdown requested its grant revocation; revocation was not independently reread. Test servers were stopped. No real lists or memberships were changed.

Evidence: [desktop list](screenshots/design-implemented-desktop.png), [phone actions](screenshots/design-implemented-phone.png), [320px sections](screenshots/design-implemented-sections-320.png), [desktop task](screenshots/design-implemented-task-desktop.png), [phone task](screenshots/design-implemented-task-phone.png), [sign-in](screenshots/design-implemented-sign-in.png), [MCP SDK host](screenshots/design-implemented-mcp.png).

## Release and verification limits

Implemented and verified locally; no deployment, GitHub push or production smoke check was performed. Physical iPhone/Android behavior, a manual screen-reader review, actual browser zoom controls and named ChatGPT/Codex interactive-host rendering remain separate checks. Viewport and color-pair checks do not certify accessibility conformance or device performance.
