# Task notes and Waffles' voice

Updated: October 16, 2026

## Confirmed scope

Task content comes before native mobile. This milestone adds formatted text and Markdown first; the user explicitly deferred private image uploads to a later pass. That text-only pass is complete; the follow-up [private images milestone](task-images.md) adds images with Vercel Blob. Subtasks, deadlines and scheduling remain outside these builds. Markdown checklists are text inside notes, not Wuff subtasks.

## Shared content contract

Every task has `content: string`, defaulting to `""`. Markdown is the canonical stored format, not editor JSON or HTML. Existing HTTP `POST`/`PATCH /api/v1/tasks` and MCP `create_task`/`update_task` accept optional `content`; an empty string clears it. Omission preserves existing notes. `get_list` and web snapshots include it. Existing task titles remain plain text and retain inline name editing.

Content preserves whitespace and is limited to 16,000 JavaScript string characters by shared contracts. The task route accepts up to 128 KiB of JSON text to accommodate escaped content; other JSON endpoints retain their 32 KiB limit. Notes use the existing list version, actor-scoped operation UUID, shared domain services, `tasks:write` scope, admission and owner/editor membership checks. They advance the list version, so existing Realtime invalidation and polling also refresh changes from MCP. Archived task notes are readable but cannot be changed.

Drizzle migration `0003_strange_dark_phoenix.sql` adds one non-null text column with an empty-string default. It preserves existing tasks and touches no auth-managed tables. Deployment order: apply the additive migration, then deploy the application. Recovery can deploy the previous application while retaining the unused column; do not drop notes to roll back the UI.

## Website

The October 16 UX follow-up supersedes the original two-step notes panel and format switch. Each task row has Edit, Notes and Delete icons beside a drag handle. Edit opens the inline task form; section choice is inside that form and saves atomically with the name. Notes opens Tiptap immediately, including for empty notes. There is no intermediate empty card, read/edit step, Markdown tab, source textarea, duplicate preview or normal editor-format guidance.

Tiptap is loaded on demand and Markdown remains the canonical format behind the scenes. The toolbar covers bold, italic, strike, headings, bullet/numbered lists, quotes, code blocks, links and undo/redo. Tables and checklists can be edited as note content. Save closes the panel; Escape/Cancel discards the draft and returns focus to Notes. Hiding notes with their icon retains the in-memory draft until reopened. No durable/offline draft storage is added.

Live refresh does not replace an open notes draft. A changed remote note shows the latest content and an explicit “Save my notes” choice; version checks still reject a server race. Drafts survive moves between sections and active/completed groups. Archived notes open read-only, and a draft already open at archive time is retained but cannot be saved until restored.

Unsupported syntax from an AI/client must never be silently dropped. HTML, external image and extended syntax bypass Tiptap's HTML import; notes that cannot roundtrip through the editor also use a selectable, rendered preserved block. Wuff's private attachment images now have a native editor node; see [task images](task-images.md). Its original Markdown serializes verbatim and its HTML/images remain non-executing/non-loading. People can append rich text or deliberately select/delete/replace that block, without a format switch. Unchanged opening/saving preserves the original string.

Tasks reorder by dragging within their section. Sections and the personal sidebar also use drag handles; arrows and the sidebar's extra Reorder mode are removed. Pointer/touch activation is confined to the handle, so the rest of the row stays available for scrolling and text editing. Keyboard users pick up with Space, use arrows, drop with Space and cancel with Escape, with spoken names/positions and restored handle focus after saving. Ordering stays authoritative on the existing revisioned endpoints. If item membership/order changes during a drag, abandon that drag; merging a visible subset preserves all other section/archived positions. Moving a task to another section remains an edit-form choice. See [task controls](task-controls.md).

## MCP and MCP App

Structured tools accept and return Markdown independently of UI support. Tool descriptions explain the content field, limit and empty-string clearing behavior; existing OAuth scopes and tool names remain unchanged. Clients may need to refresh their catalog to discover the new fields.

The sandboxed MCP App provides a textarea Markdown editor with a live preview, explicit Save/Cancel, and the same saved-note renderer. It does not bundle Tiptap or promise the website's visual toolbar. In-memory drafts survive tool-result rerenders, show remote content differences, and are removed on successful save, cancellation, task removal or account changes. Uncertain saves retry the identical operation/version. Definitive refusals reread the list before retrying. No data is persisted offline.

## Rendering and links

Web and MCP App share `task-markdown.ts` and its prose styles. Markdown-it renders with HTML disabled, so raw HTML appears as text. Only full HTTP(S) and mailto links are clickable; protocol-relative, relative, control-character and executable URLs are rejected. External links open with `noopener noreferrer`. External image syntax renders as an escaped placeholder with alt text and never loads a third-party URL. The subsequent [private image milestone](task-images.md) permits only exact Wuff attachment paths, with current server-side admission/list authorization for delivery.

Markdown checklist boxes are decorative, accessible checked/unchecked markers. They do not send task-completion requests. User-supplied task names, notes, list names, email addresses and client names are never rewritten to add jokes.

## Voice

Waffles is a friendly little companion, not a corporate mascot. The user's requested corgi wordplay applies across greetings, guidance, loading/empty states and feedback, on the website and embedded app: “Welcome to the pack,” “a little more de-tail,” “taking a paws,” and “Ruff patch!”

Keep action labels, field names, access rules and irreversible consequences explicit. For example “Save notes,” “Delete list,” “Email,” and “Allow connection” stay easy to identify; their surrounding guidance carries the wordplay. Never soften a failure into a success or obscure who has access. Shared error presentation adds the voice while stable error codes, API keys, OAuth scopes and machine contracts stay unchanged. Tool responses remain structured data without synthetic success chatter.

## Sources

- [Tiptap Markdown usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)
- [Tiptap Markdown status and limitations](https://tiptap.dev/docs/editor/markdown)
- [Tiptap React integration](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Markdown-it documentation and security guidance](https://github.com/markdown-it/markdown-it)

## Verification

- `pnpm check` passed: workspace/root TypeScript, 16 unit tests and optimized Next.js/MCP App builds. A subsequent final build passed after metadata/checklist spacing adjustments. Static bundle scanning found no environment secrets or domain SQL in 20 browser scripts.
- Development integration: the existing 13 integration tests passed, including real Neon login, OAuth, MCP protocol, web-to-MCP/MCP-to-web Markdown and live version delivery. The new task-content integration test passed after correcting its synthetic cleanup bookkeeping, covering private/shared access, read-only scope, identical retries, changed-input rejection, stale concurrent writes, explicit clearing, completed notes, archive restrictions and revoked-access receipt replay. No production data was used for those tests.
- Browser checks on the optimized local build: rich text to source/preview/save roundtrip; unchanged opening without synthetic trailing-paragraph edits; Markdown clearing; safe HTML/image source fallback with zero note image/script elements; MCP edits arriving through live refresh while a web draft remains intact; cancelling to the latest notes; drafts surviving a remote completion into the Completed group; and MCP stale-version failure, draft retention, refresh and successful retry in an `allow-scripts` sandbox using the official MCP Apps SDK host.
- Chrome phone viewport measured `innerWidth = scrollWidth = 390`, with the editor fitting the page and wrapping its toolbar. This is responsive browser evidence, not an iPhone/Android device test. Screenshots: [website editor](screenshots/task-notes-editor.jpg), [phone layout](screenshots/task-notes-mobile.jpg), [MCP App](screenshots/task-notes-mcp.jpg).
- The additive migration passed on isolated development and production direct connections. Production list/task/membership record counts were unchanged by the migration.
- Production release: feature commit `2887e6923327ab7d4b7febf6a4604d43ea4aca7a` and MCP host-result preservation follow-up `be0e81814dab085a1b3284cc689b34a36997a14a` are pushed. Both GitHub checks passed. CLI deployment `dpl_JBSnyEyKJLKrUFLjCu3REAYifHQG` is READY, reports runtime region `fra1`, and is aliased to [Wuff Todo](https://wuff-todo.vercel.app). Vercel also built the production application successfully.
- Production smoke: sign-in and OAuth discovery return 200; unauthenticated list API and MCP requests return 401. Using the existing real browser session, a disposable synthetic task loaded Tiptap, saved Markdown via the authenticated web API, and rendered it correctly. A separate server read verified the exact saved Markdown, then the disposable production list was removed and verified inaccessible. [Synthetic production screenshot](screenshots/task-notes-production.jpg) excludes the real list sidebar. Development browser fixtures were also removed and their OAuth grants verified revoked; the local dev server is restored.
- Authenticated production Codex/ChatGPT and named-host interactive UI have not been reverified for this milestone; local protocol/SDK-host checks do not substitute for them. Existing clients may need a tool-catalog refresh to discover the new content input. The sandboxed App keeps notes visible when a host forwards a result for another view or an error.
