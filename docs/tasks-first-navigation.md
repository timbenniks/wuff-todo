# Tasks-first list workspace

October 31, 2026. Tim selected the Tasks first proposal after inspecting the live
Cosmic Breakfast list. Todo owns this presentation-only follow-up to the
productivity redesign. Root AGENTS.md, apps/web/AGENTS.md (when touching the web
app), wuff-contributor and the module/surface/design/accessibility guides apply.

## Brief and acceptance

- Open each list on Tasks. Offer Tasks / Sublists tabs only when accessible active
  sublists exist. Show all sublists as aligned directory rows, not wrapping links.
- Preserve the parent/sibling navigation, personal tree order, shared indicators,
  permission boundaries, task drafts and existing view controls. Tab selection is
  transient, list-local UI state; it creates no saved preference.
- Add task from Sublists returns to Tasks and opens the existing inline composer.
- Remove the desktop sidebar's nested scrolling region. Navigation and content
  flow in the document; long trees and footer controls remain reachable.
- Tighten heading/toolbar/section spacing and sidebar rows while retaining touch
  targets, keyboard focus, long-title wrapping and existing palettes/appearance.
- Exercise 320/390px, intermediate and desktop layouts, light/dark, keyboard tabs,
  draft preservation, child/parent navigation and loss of catalog access.

## Surfaces and scope

Shared Todo web/PWA React components and Todo-scoped presentation CSS. Existing authorized
catalogs and list/task/view HTTP/MCP domain operations remain the data source.
No persisted mutation, API contract, schema, scope, consent, connection lifecycle,
provider, dependency or safeguard change. The MCP App has a separate, compact DOM
renderer (it does not use React ListApp). Its existing parent/child navigation and
tool capabilities remain complete; these website layout changes do not require
new embedded controls or change connection recovery/revocation. No production
writes or deployment are authorized by this work.

Unit plan: list-local tab selection, no-child/removed-child fallback, capture
event isolation and accessible catalog filtering. Browser checks must exercise
real components; synthetic local runtime fixtures are presentation evidence only,
not backend/auth integration proof. This Windows checkout's documented main-data
configuration prohibits integration seeding/writes unless isolated readiness is
independently confirmed.

## Evidence

- `pnpm install --frozen-lockfile` restored this checkout's stale dependency links;
  no manifest/lockfile change. The initial typecheck failed on missing React links.
- `pnpm typecheck` passed after moving obsolete generated `.next/dev` cache into
  ignored `test-results/pre-pull-next-dev`; the old validator referenced retired
  pre-pull route locations. No application source was changed to suppress errors.
- `pnpm build` passed: generated guide, MCP bundle and optimized Next web build.
- `node --import tsx --test tests/tasks-first.test.ts`: all six browser component
  tests pass, no skips. The actual React components run on a loopback-only host
  with a synthetic runtime that rejects every persisted write. Cases cover default
  and keyboard tab selection, seven-child directory, draft retention, matching
  and unrelated capture events, missing/archived catalogs, parent/sibling routing,
  header capture and saved views, 320/390/768/1280px overflow, long titles, dark
  appearance, reachable sidebar footer, coarse-pointer 44px navigation and 25-task
  document scrolling with drawer focus/position restoration. No page errors in the
  responsive workspace case. This is component evidence, not authenticated parity.
- Regression proof: temporarily substituting main's old ListContext makes the
  first component case fail (exit 1, missing Tasks tab); restoring the feature
  component passes all six cases.
- `pnpm test` ran: the initial full run had 191 passes and three existing Windows
  failures. `empire-modules.test.ts` and `mcp-tool-choices.test.ts` dynamically
  import raw `C:` paths, rejected by Node's ESM loader; `unit-discovery.test.mjs`
  compares Windows separators with literal POSIX paths. These unchanged tests are
  not weakened/skipped here. Hosted Linux results are recorded in the PR.
- Existing isolated integration scripts now target the web tabs and document
  scroll. They were not run: this checkout documents main-data credentials, with
  no confirmed isolated backend. No integration writes or production mutations.
- No new persistence/auth adapter behavior; embedded MCP's independent DOM
  navigation and existing tool contracts stay unchanged. Physical-device,
  screen-reader and live backend integration proof remain separate.

[Desktop](screenshots/tasks-first-desktop.png) ·
[Phone sublists](screenshots/tasks-first-phone.png) ·
[Dark directory](screenshots/tasks-first-dark.png). Screenshots use synthetic data.

Preserved pre-existing local edits to docs/development.md and docs/verification.md
outside this feature's commits. PR remains draft while full local verification and
current-head review are incomplete; merge/release require separate instructions.

## Review correction

Codex finding [discussion_r4431991909](https://github.com/timbenniks/wuff-todo/pull/47#discussion_r4431991909)
identified lost keyboard focus when a live catalog removes the final child while
its directory button is focused. The component now remembers navigation focus
before reconciliation and restores main-content focus during layout when that
control disappears. Focus on an unrelated control is preserved. It also covers
removal of the focused Tasks tab itself. The added browser regression fails on
the pre-fix source (exit 1, expected main focus) and passes with the fix; all seven
focused component cases pass. The original head's hosted Linux check passed 211
tests with no failures/skips; it does not cover this correction. Current-head
checks and fresh Codex review are tracked in PR #47.
