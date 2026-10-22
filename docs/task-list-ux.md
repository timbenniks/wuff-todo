# Task list UX

Updated: October 22, 2026

The website and embedded MCP App now follow the UX sketches in the “Fix Todo Layout” conversation. This supersedes the earlier [spacing-only revision](task-row-spacing.md). The refactor reuses the existing task model, API, authorization, versions and mutation receipts.

## Rows and density

Every row reserves columns for dragging, completion, content and one overflow button. Desktop drag handles appear on hover or keyboard focus, with the space reserved at all times. Phone handles stay visible and retain 44px targets. The existing keyboard drag and click-to-position picker remain available.

Compact uses one title line and shows urgent due dates, sync problems and blocked status. Comfortable allows two title lines and adds meaningful metadata below the title. A pure presentation policy orders urgent cues ahead of organization/progress and supporting resources, limits the visible cues to three, and offers a labeled `+N more` link to details. Routine “Synced,” default “Todo,” “No priority” and empty notes are omitted from rows. Pending sync is neutral and appears only in Comfortable mode. Completed titles are muted and struck through.

Density buttons save immediately through the existing per-account/list view operation. The stored values remain `compact` and `detailed`; `detailed` is presented as Comfortable in both interfaces. Existing saved choices and default values are preserved. The website's full Your view form retains Apply/Reload/Reset, and disables quick density changes while that form has unsaved changes. There is no migration or local-storage preference fallback.

Secondary actions—including rename, notes, due date, subtasks, work details, section movement and confirmed deletion—are available in a native auto-dismiss popover. It stays inside the viewport, supports Escape, and has labeled controls. Quick editors remain available inline. No paid agent is started by opening a task or a menu.

## Task details

An ordinary title click opens a right-side desktop drawer or a full-screen phone sheet while the list stays mounted at its current scroll position. Modified clicks and task URLs continue to support separate tabs/direct pages. The drawer uses a native modal dialog for focus containment, Escape and background dismissal; its visible list context remains in place. Closing restores focus to the initiating control, with a list-content fallback if that control disappears.

`TaskDetailContent` is shared by the drawer and standalone task page. It reuses title, notes/private images, dates, work metadata, references, subtasks, GitHub and Cursor controls. Notes come first; GitHub and coding-companion sections are disclosed on demand and only start their existing reads when first opened. Drawer task writes and refresh use the list's existing controller/cache, avoiding a second task snapshot or another live subscription. Existing explicit saves and draft/conflict behavior are retained rather than adding new autosave semantics.

Close/navigation checks protect unsaved title, notes, date, work, subtask and integration drafts. Pending writes/uploads and uncertain requests keep the drawer open until settled/retried. Reload/navigation also receives the browser's normal unsaved-change protection. These checks do not change permissions or request retries.

## Embedded MCP App

The `show_list` and `show_lists` App resource received the corresponding UI pass after the website review. Both renderers now use the same pure `taskMetadata` policy. The embedded task view has reserved completion/title/action columns, one action disclosure, matched Compact/Comfortable labels and saved preferences, quiet healthy sync/default states, and the same three-cue budget with a labeled overflow control.

Title clicks expand the existing editors inline rather than opening a drawer inside the host iframe. Notes, dates, work fields, GitHub controls, section movement, subtask controls and confirmed deletion remain available. The native action disclosure expands in document flow so the host can resize it without clipping a floating menu. Completion and action targets measure 44px. Existing subtask drag/Alt+Arrow/position controls are preserved. Catalog rows now expose their ordering buttons through one disclosure and retain shared-list labels.

Quick density saves retain their exact operation ID/payload after an unknown error and block conflicting view edits until retry resolves. Metadata also refreshes when the viewer's calendar day changes. The change adds no tool, OAuth scope, dependency or server adapter.

The final embedded App was exercised in the official MCP Apps SDK `AppBridge`/`PostMessageTransport` host, with the normal sandboxed iframe and **synthetic in-memory tool responses**, not a connected production MCP account. Checks covered notes/date saves, completion, rename and restored title focus, subtask creation/completion/deletion confirmation, catalog/shared labels and ordering disclosures, density persistence across host reopening, and notes-draft retention when the host forwards a new list result. A deliberately lost density response applied once; exact retry left the fixture at four view writes/revision five rather than applying it again. Pending density saves disabled conflicting form controls, and quick editing focused its text field rather than the file-upload control.

Both embedded densities were measured at iframe widths 320, 390, 600, 640 and 840px. Document width matched iframe width, root action columns aligned, metadata started at the title column, Compact text was one 22px line, and Comfortable text was at most two 22px lines. The iframe checks are local SDK-host UI evidence, not a new live server/OAuth/permission proof or a guarantee of a named ChatGPT/Codex host's current behavior. Production resources and client caches still require deployment/reopening before that check.

## Verification

- `pnpm check` passed: workspace/root TypeScript, all 60 unit tests, and optimized web/MCP builds. Four new tests cover metadata defaults, hierarchy/budget, Compact urgency and neutral pending sync. Later presentation/guard refinements passed a fresh web build with TypeScript.
- The real production-mode Next.js application ran locally on port 3100 against the existing isolated development services. Synthetic browser actions saved density and retained it across reload, renamed a task in the drawer, saved quick date/notes edits, changed work status/priority, created and completed a subtask, and completed a root task. An independent authorized domain read confirmed the persisted results and manual order.
- Keyboard pickup, ArrowUp and drop moved a task; the existing position picker also saved a new position. Focus returned to the task after closing details. A changed title triggered the leave/discard prompt and Keep editing preserved its draft.
- An independent synthetic remote note update appeared through regular refresh while an unsaved drawer draft remained intact, with the existing remote-change notice and latest-version preview. Cancelling restored the remote saved notes.
- At 320, 390, 639, 640 and 1280px, both densities had document width equal to viewport width and identical action-column positions across rows. Compact titles measured 22px and Comfortable titles never exceeded 44px. Visible phone row buttons measured 44px high. A padded line-clamp initially exposed part of a third line; moving clamping to the inner text span corrected the final screenshots. Full-screen sheets measured exactly 320/390px without body overflow.
- A separate in-memory component fixture covered linked GitHub tasks and attention states. Healthy sync labels were absent, issue links remained visible, attention preceded supporting cues, and every action column aligned. It also verified the desktop drawer at 680px wide in a 1280px viewport, with list context visible alongside it. This did not contact GitHub or create issues.
- Task creation and the delete-confirmation UI worked. The final deletion smoke encountered a transient managed-auth session-check failure before its mutation could be confirmed; that case is not claimed as passing. The disposable list and all its tasks were subsequently removed through the authorized development fixture cleanup.

These are local UI and synthetic persistence checks. No production deployment, physical-device certification, new installed MCP-host check, live GitHub-provider action or paid agent execution is claimed. The development application used regular refresh; this run does not establish Realtime-origin support for port 3100. Existing native work and infrastructure configuration are outside this change.

## Screenshots

- [Comfortable desktop](screenshots/task-ux-comfortable-desktop.png)
- [Compact desktop](screenshots/task-ux-compact-desktop.png)
- [Comfortable at 320px](screenshots/task-ux-comfortable-320.png)
- [Desktop drawer](screenshots/task-ux-drawer-desktop.png)
- [Mobile sheet](screenshots/task-ux-sheet-mobile.png)
- [GitHub presentation fixture](screenshots/task-ux-github-fixture.png)
- [MCP App Comfortable in the SDK host](screenshots/task-ux-mcp-comfortable.png)
- [MCP App Compact at 320px](screenshots/task-ux-mcp-compact-320.png)
- [MCP list catalog at 320px](screenshots/task-ux-mcp-catalog-320.png)

The earlier [spacing preview](screenshots/task-row-spacing-desktop.png) records the previous row design. All new screenshots use synthetic development/component fixtures.

## Row dragging and the leading gutter — October 22 follow-up

Removed the reserved drag column from website task rows (including subtasks and read-only/completed rows). Completion now starts at the row's leading edge; title, metadata and trailing actions retain fixed alignment. The MCP task layout already uses three columns without this drag gutter.

Reorderable website rows use the existing sortable/domain ordering flow with a 6px mouse activation threshold. Touch requires a 250ms hold with 5px movement tolerance; ordinary vertical swipes retain scrolling. Checkbox, metadata, menu, nested task and editor interactions do not start a parent drag. A completed/cancelled drag suppresses its release click. Clicking summary space or pressing Enter on the focused row opens the task; Space picks it up for arrow-key ordering. “Move to position” remains in the trailing actions menu. Other sortable surfaces retain their existing dedicated handles.

Local verification uses the real React task/sortable components with an in-memory synthetic list and mutation adapter, without account or database writes. Chromium checks passed for blank-row/Enter opening, checkbox isolation, menu/position picker, keyboard ordering, mouse drag ordering and release-click suppression. At measured 320px, 390px and 1280px widths the checkbox starts at the row edge, retains a 44px target, and the document has no horizontal overflow. Chromium touch emulation passed ordinary swipe scrolling with no mutation, held-touch ordering without opening details, and independent checkbox tapping. Both densities passed the responsive geometry checks. `pnpm check` passed all workspace/root TypeScript checks, 60 tests, and optimized web/MCP builds. This is browser emulation, not physical-device or deployed-session proof. [390px screenshot](screenshots/task-row-no-gutter-390.png).
