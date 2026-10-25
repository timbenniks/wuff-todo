# Wuff Notes

Status: implementation in progress on `codex/wuff-notes`; not released.

## Brief and acceptance

Build Notes as a first-class Empire module using Todo/Totake's module boundaries,
shared account/design system and authorized HTTP/MCP/native domain services.
Root AGENTS.md, apps/web/AGENTS.md, wuff-contributor and the surface contract apply.

- [ ] Private notes with title/rich text using Todo's editor, explicit Save/Cancel,
  retained drafts, conflicts and identical retries after unknown outcomes.
- [ ] Search, normalized tags and personal pinned/archive choices.
- [ ] Owner-controlled sharing with admitted Empire accounts as Viewer or Editor;
  only owners manage access/trash. Editors edit shared content; viewers read.
- [ ] Linked notes/backlinks and moodboards with text, private images, external
  links and linked-note cards. Seven approved themes; accessible card ordering.
- [ ] Settings and opt-in pinned/recent dashboard contributions.
- [ ] HTTP/MCP/native read/write parity and an interactive MCP Notes browser/editor.
- [ ] Explicit Todo export to a selected accessible list, preserving a source link;
  copy text only on explicit confirmation. One atomic, retry-safe transaction.
- [ ] Meaningful success/boundary/failure unit tests, isolated real adapter proof,
  phone/desktop/keyboard/recovery browser checks and a current draft PR.

## Confirmed choices and privacy

Tim accepted personal pin/archive choices, owner-controlled Viewer/Editor sharing,
and moodboards with text/private images/links/linked-note cards. New notes are
private. Sharing a note never shares linked notes, Todo lists, Totake records or
provider credentials. Structured links/cards/backlinks and exported task previews
are access-filtered on every read; revocation takes effect on images and receipts.
No public links, external preview fetching, live collaborative editing, AI rewriting,
new admission model, paid provider, notifications or production release is included.

Moodboards are ordered responsive grids with shared theme/content and keyboard
move controls. Notes and moodboard modes preserve each other's content. Private
images use the existing isolated private Blob store and shared image normalization;
no remote image URLs load automatically. Trash is reversible and owner-controlled.

## Data and surfaces

Prepare additive Drizzle tables owned by Notes: notes, memberships, personal note
preferences, note links, board items, private assets, user settings and Todo export
references. Preserve auth-managed tables and existing app data. Migration execution
is a separate explicit authorization step; no production migration is authorized
by this brief.

Use Notes read/write/manage scopes, explicit consent and per-connection tool
choices; old grants/defaults do not expand. Settings and personal choices are also
available through HTTP/MCP/native. Reads are bounded and permission filtered before
search/projection. All writes validate versions and exact operation fingerprints.
Embedded MCP UI uses the shared host; standalone tools remain complete.

## Unit and verification plan

Cover validation/tag normalization/safe links; owner/editor/viewer/outsider and
revocation; link/card privacy; archive/pin isolation; settings; stale and concurrent
writes; exact/changed receipts; atomic Todo export; image normalization/ownership;
HTTP/MCP/native consent and parity; browser draft/retry/conflict recovery and
320/390/desktop overflow. Synthetic development data only, never production writes.

## Delivery evidence

Pending implementation. Unrelated local package/pnpm edits remain excluded. Keep
the PR draft while any required verification or remote execution is blocked.
