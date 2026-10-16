# Task notes and Waffles' voice

Updated: October 16, 2026

## Confirmed scope

Task content comes before native mobile. This milestone adds formatted text and Markdown first; the user explicitly deferred private image uploads to a later pass. Subtasks, deadlines and scheduling are not part of this build. Markdown checklists are text inside notes, not Wuff subtasks.

## Shared content contract

Every task has `content: string`, defaulting to `""`. Markdown is the canonical stored format, not editor JSON or HTML. Existing HTTP `POST`/`PATCH /api/v1/tasks` and MCP `create_task`/`update_task` accept optional `content`; an empty string clears it. Omission preserves existing notes. `get_list` and web snapshots include it. Existing task titles remain plain text and retain inline name editing.

Content preserves whitespace and is limited to 16,000 JavaScript string characters by shared contracts. The task route accepts up to 128 KiB of JSON text to accommodate escaped content; other JSON endpoints retain their 32 KiB limit. Notes use the existing list version, actor-scoped operation UUID, shared domain services, `tasks:write` scope, admission and owner/editor membership checks. They advance the list version, so existing Realtime invalidation and polling also refresh changes from MCP. Archived task notes are readable but cannot be changed.

Drizzle migration `0003_strange_dark_phoenix.sql` adds one non-null text column with an empty-string default. It preserves existing tasks and touches no auth-managed tables. Deployment order: apply the additive migration, then deploy the application. Recovery can deploy the previous application while retaining the unused column; do not drop notes to roll back the UI.

## Website

Each active or completed task has an expandable notes panel. Tiptap 3 is loaded on demand when editing, keeping the editor out of the initial list bundle. The toolbar covers bold, italic, strike, headings, bullet/numbered lists, quotes, code blocks, links and undo/redo. Markdown input shortcuts work in the visual editor. Tables and Markdown checklists can be imported and edited as content. A source mode includes the same preview renderer as saved notes.

Save is explicit; Escape/Cancel returns to saved notes, and Cmd/Ctrl+Enter saves. Live refresh does not replace an open draft. If the saved content changes while editing, show the latest version alongside the retained draft and require the explicit “Save my notes” choice to replace it. A server race still fails with a stale-version conflict. Save failures retain the draft and use the existing uncertain-request retry UI. Leaving a task/list or reloading does not persist drafts; this does not add offline storage.

Tiptap's Markdown bridge is currently beta. On opening the editor, compare rendered original content with its serialized output. If conversion changes the rendered content, fall back to Markdown source before any edit, retaining the original string. Unchanged open/save also preserves the original Markdown. This conservatively favors source editing over lossy conversion of unsupported syntax.

## MCP and MCP App

Structured tools accept and return Markdown independently of UI support. Tool descriptions explain the content field, limit and empty-string clearing behavior; existing OAuth scopes and tool names remain unchanged. Clients may need to refresh their catalog to discover the new fields.

The sandboxed MCP App provides a textarea Markdown editor with a live preview, explicit Save/Cancel, and the same saved-note renderer. It does not bundle Tiptap or promise the website's visual toolbar. In-memory drafts survive tool-result rerenders, show remote content differences, and are removed on successful save, cancellation, task removal or account changes. Uncertain saves retry the identical operation/version. Definitive refusals reread the list before retrying. No data is persisted offline.

## Rendering and links

Web and MCP App share `task-markdown.ts` and its prose styles. Markdown-it renders with HTML disabled, so raw HTML appears as text. Only full HTTP(S) and mailto links are clickable; protocol-relative, relative, control-character and executable URLs are rejected. External links open with `noopener noreferrer`. Image syntax renders as an escaped placeholder with alt text and never loads a third-party URL. No image upload or attachment permission claim is implied.

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
- Production deployment and smoke checks: pending release below. Authenticated production Codex/ChatGPT and named-host interactive UI have not been reverified for this milestone; local protocol/SDK-host checks do not substitute for them.
