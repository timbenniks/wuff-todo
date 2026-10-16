# Direct task actions and drag ordering

Confirmed October 16, 2026, from the user's screenshot feedback.

- Website rows put Edit, Notes and Delete beside a drag handle. Remove the title's extra pencil, repeated Add notes labels and the intermediate empty note card.
- Edit opens an inline form immediately. Section selection appears inside that form and is committed in the same task update as the title; section-only changes also save.
- Notes opens Tiptap immediately. Save closes it; Cancel/Escape returns to saved content. Hiding/reopening retains the transient draft. A filled notes icon indicates saved content. Completed tasks have the same actions; archived notes are read-only.
- There is one editor, no Markdown/source switch and no duplicate preview. Markdown stays in the shared API/database contract. Syntax the visual schema cannot preserve is a safe rendered block retaining its original bytes, not an excuse to bring back a source tab.
- Tasks drag within their current section; owners drag sections; everyone drags their own sidebar lists. A task moves between sections using Edit. Pointer dragging uses the grip alone; touch scrolling remains available elsewhere on the row. Space/arrows/Space and Escape provide keyboard drop/cancel with announcements and focus restoration.
- Existing access checks, versions, idempotency and API/MCP operations remain authoritative. No schema migration, auth change or new backend endpoint is required. The MCP tool contract and existing embedded App are unchanged by this website interaction pass.
- Reordering a subset preserves every other item's position. Refuse a stale subset or a changed item order during drag rather than dropping or reviving IDs. Keep existing uncertain-write handling, and never describe a failed write as saved.

Implementation uses dnd-kit's established React sortable API, with pointer and keyboard sensors and drag previews. Tiptap remains lazily loaded. Existing auth dependencies were kept pinned while adding the drag packages; installing new UI dependencies must not accidentally upgrade auth peers.

Sources: [dnd-kit sortable](https://dndkit.com/legacy/presets/sortable/overview/), [Tiptap Markdown extension integration](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension).

## Verification

- `pnpm check` passed with workspace/root TypeScript, 19 unit tests and optimized Next.js/MCP builds. Final UI follow-ups also passed TypeScript/build and the same 19 unit tests. Tests cover hidden-item/other-section order preservation, stale/invalid subsets, unsafe note content and exact serialization of preserved content.
- Browser on the optimized development build: one-click task editing; one-click empty/existing Tiptap notes; bold text saved as Markdown; section-only edit persisted without renaming; mouse task dragging; keyboard task, section and sidebar reordering; persisted section/personal sidebar order; Escape cancellation; and grip focus restored after saving. Save confirmation waits for the server response.
- A real authenticated MCP protocol completion moved a task into Completed while retaining the open rich text draft. Cancel returned to saved content. A note containing HTML and image syntax opened in Tiptap as a safe preserved block (zero source switches, source textareas, note image or script elements); adding text preserved the original HTML/image Markdown in a server reread.
- Chrome measured `innerWidth = scrollWidth = 390` with the compact controls and wrapping toolbar. This is responsive browser verification, not a physical touch-device test. [Desktop editor](screenshots/task-controls-editor.jpg), [phone editor](screenshots/task-controls-mobile.jpg).
- Static browser bundle scanning found no environment secrets or domain SQL. No database schema or auth configuration changed.
- Production: source `5b0d13bc0c69197bdaa8e9dbb1ed3c84598c1232` passed [GitHub checks](https://github.com/timbenniks/wuff-todo/actions/runs/38895714561). CLI deployment `dpl_5BHRGihsV1zWQsBE5NLNoA8yNvSc` is READY, reports runtime region `fra1` and aliases [Wuff Todo](https://wuff-todo.vercel.app). The Vercel production build passed.
- Using the existing signed-in production browser session and a disposable list, verified direct inline rename, direct Tiptap notes with no source tab, bold text save/close, and mouse drag/drop. A separate server reread verified the exact title, Markdown and final task order, then removed the disposable list and verified it inaccessible. [Synthetic production screenshot](screenshots/task-controls-production.jpg) excludes the real sidebar. Sign-in/discovery remain 200 and unauthenticated list API/MCP remain 401.
- Development browser fixtures were deleted and their OAuth grants verified revoked; the local dev server is restored. Named-host MCP App behavior was not changed or re-certified in this website pass.
