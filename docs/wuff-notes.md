# Wuff Notes

Status: implemented on `codex/wuff-notes`, draft PR #33; not released.

## Brief and acceptance

Build Notes as a first-class Empire module using Todo/Totake's module boundaries,
shared account/design system and authorized HTTP/MCP/native domain services.
Root AGENTS.md, apps/web/AGENTS.md, wuff-contributor and the surface contract apply.

- [x] Private notes with title/rich text using Todo's editor, explicit Save/Cancel,
      retained drafts, conflicts and identical retries after unknown outcomes.
- [x] Search, normalized tags and personal pinned/archive choices.
- [x] Owner-controlled sharing with admitted Empire accounts as Viewer or Editor;
      only owners manage access/trash. Editors edit shared content; viewers read.
- [x] Linked notes/backlinks and moodboards with text, private images, external
      links and linked-note cards. Seven approved themes; accessible card ordering.
- [x] Settings and opt-in pinned/recent dashboard contributions.
- [x] HTTP/MCP/native read/write parity and an interactive MCP Notes browser/editor.
- [x] Explicit Todo export to a selected accessible list, preserving a source link;
      copy text only on explicit confirmation. One atomic, retry-safe transaction.
- [x] Meaningful success/boundary/failure unit tests, isolated real adapter proof,
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
was explicitly authorized by Tim for development and production. Development
0021 is applied, followed by the identical reviewed migration in production.
Both read-backs confirmed eight Notes tables and unchanged existing app snapshots. Application release remains a separate merge/release step.

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

- `pnpm typecheck`: all packages, applications and root scripts/tests passed.
- `pnpm test`: 198 unit tests, no skips. Notes covers strict content/action
  contracts, normalized tags, safe links, bounded pagination/images, scope/tool
  choices, role capabilities, link-card privacy, recovery, native adapter mapping,
  native upload limits, stable SSR/browser dates and Notes-only consent. Registry
  tests cover declared cross-module scopes and schema snapshot equivalence.
- `pnpm build`: optimized web, guide and MCP bundle passed. Native frontend
  `pnpm build:native:web` passed with existing chunk-size advisory; no installer
  or physical device proof is implied.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/notes.integration.test.ts`: both real development cases passed. Domain
  proof includes private/Viewer/Editor/owner boundaries, revocation, hidden linked
  IDs/titles, pin/archive isolation, stale/concurrent edits, exact/changed receipts,
  card updates/order, settings defaults/dashboard, atomic Todo creation/rollback
  and private Blob normalization/readback. Actual HTTP/MCP/native proof includes
  both write/read directions, all action families, settings/dashboard/images,
  consent, read-only/legacy grants, refresh without expansion, origin/account
  guards and denied replay after OAuth revocation. Synthetic rows/assets are
  removed and settings restored in finally.
- Existing `tests/domain.integration.test.ts`, `tests/list-features.integration.test.ts`
  and `tests/totake.integration.test.ts`: all 11 real development regression cases
  passed, including Todo transactions, sharing, personal state and Totake adapters.
- Optimized local Chrome and the real MCP Apps SDK host: rich note/theme saves,
  dirty-navigation protection, concurrent remote change with retained draft,
  explicit latest-note recovery, small-phone text-card creation, Todo destination
  confirmation and source reference. The SDK host deliberately loses a committed
  note reply, then confirms identical explicit retry arguments and reconciled
  content. Private images render through the authorized HTTP and MCP paths.
- 320/390/1280px phone/desktop review found no document horizontal overflow.
  A locale-dependent date hydration mismatch was found, fixed and regression
  tested; a fresh final-build tab has no captured browser errors.

## Limits and release gates

The Chrome extension left the file chooser empty. Browser file selection/upload
itself remains unverified until Allow access to file URLs is enabled; real private
upload, byte normalization, permissions and reads passed the domain/HTTP/MCP/native
integration checks. Local SDK-host proof is separate from named production
ChatGPT/Codex host behavior. Physical keyboard/touch, screen readers, installed
native clients, preview backend isolation and production app runtime are separate
checks. Native operations are implemented; native product navigation is unchanged.

Initial limits are 1,000 owned notes, 100 cards per board, 24 private images per
note, 16,000 content characters, 20 tags and bounded search pages (default 50,
maximum 100). Trash is reversible and retains assets. Physical purge and permanent
asset removal need a separate retention design. No new notification delivery or
provider configuration is included.

Unrelated local root package/pnpm edits remain excluded. Keep the PR draft while
required hosted checks are blocked. Tim owns merge and application release.
