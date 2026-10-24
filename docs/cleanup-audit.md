# Tauri migration cleanup

Date: October 24, 2026
Status: cleanup and local verification complete; merge/release remain with Tim.
Baseline: clean `main` at `cd9d49d`; delivery branch: `codex/tauri-cleanup-audit`.

## Maintainer authorization

Tim requested cleanup of unused Expo/React Native remnants, scripts, code and
outdated docs. After reviewing draft PR #23, he explicitly overrode the contributor
skill’s additional scope-approval step in this chat and authorized implementation.
This exception applies to this maintenance work; the contributor skill, GitHub
policy and safeguards themselves are unchanged. No approval was posted as Tim.

The explicit Expo retirement request supersedes the earlier instruction to retain
its source as a reference. It does not pass outstanding Tauri device/signing gates.
Root/web AGENTS.md, current plans, architecture, development, verification and
product/design/accessibility/surface rules informed the cleanup.

## Removed and consolidated

- Removed the 15 tracked Expo application/config/asset files (3,173,777 bytes),
  `dev:mobile`, `build:mobile`, their exclusive export scanner and Expo ignore rules.
  Ignored credentials/generated local files were not deleted.
- Removed 25 obsolete forwarding modules listed below. Three were used only by
  regression tests; those imports now target the actual shared implementations.
- Removed 15 redundant web dependency declarations. The libraries are owned by
  `@wuff/ui`; its Tiptap ProseMirror peer is now explicit there. MarkdownManager is
  a root test dependency with a public import instead of a web node_modules path.
- Regenerated the lockfile: 1,066 to 680 resolved package/version entries, with no
  new versions. The frozen install pruned Expo’s dependency tree. Remaining
  `expo-sqlite` strings are optional peer metadata in retained third-party packages,
  not an installed Expo app or resolved Expo dependency.
- Removed compiler-confirmed unused imports/callback arguments in read adapters
  and MCP, and unused UI destructuring. Also removed nine unused import/argument bindings from
  the existing browser and test harnesses without changing any assertions/cases. Public prop types and behavior remain.
  Rebuilt the guide’s generated component catalog from current shared source.
- Updated README, product/architecture/implementation/development and Tauri docs.
  The old native-mobile link now explains retirement and points to Tauri. Removed
  obsolete Expo commands and current-host/Cargo.lock claims; dated evidence stays
  historical. The existing online-only and notification-worker boundaries remain.

## Deleted forwarding modules

- `apps/web/src/app/lists/inline-name.tsx`
- `apps/web/src/app/lists/list-settings.tsx`
- `apps/web/src/app/lists/list-view-controls.tsx`
- `apps/web/src/app/lists/sharing.tsx`
- `apps/web/src/app/lists/task-actions.tsx`
- `apps/web/src/app/lists/task-detail-drawer.tsx`
- `apps/web/src/app/lists/task-due-date.tsx`
- `apps/web/src/app/lists/task-groups.tsx`
- `apps/web/src/app/lists/task-metadata.tsx`
- `apps/web/src/app/lists/task-note-editor.tsx`
- `apps/web/src/app/lists/task-notes.tsx`
- `apps/web/src/app/lists/task-row.tsx`
- `apps/web/src/app/tasks/[id]/agent-task.tsx`
- `apps/web/src/app/tasks/[id]/github-task.tsx`
- `apps/web/src/app/tasks/[id]/work-metadata.tsx`
- `apps/web/src/components/sortable.tsx`
- `apps/web/src/components/task-markdown.tsx`
- `apps/web/src/components/ui/input-group.tsx`
- `apps/web/src/components/ui/status-tag.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `apps/web/src/lib/list-cache.ts`
- `apps/web/src/lib/preserved-note.ts`
- `apps/web/src/lib/reorder.ts`
- `apps/web/src/lib/task-image-node.ts`
- `apps/web/src/lib/use-calendar-day.ts`

## Checked and retained

- `/api/mobile`, its images adapter, `NativeClient`, native contracts and tests
  support Tauri. `/oauth/native`, legacy fixed identity/defaults and callback
  registration have active server/test consumers and remain compatible.
- Every non-Expo script has an executable or documented consumer. Browser phase
  scripts are regression tools; native Python release tooling and manual workflows
  remain active. No workflow, safeguard or test-discovery setting was changed.
- The notification service worker is registered by URL. The shadcn utility shim
  is referenced in `components.json`. These are valid consumers outside imports.
- Both live-update components are used at different layers. Prototype-kit 410
  responses and old-guide redirects preserve deliberate compatibility.
- No tracked build caches/logs were found. Relative Markdown file targets exist;
  this scan does not certify anchors, external links or every historical claim.

A repeat TypeScript import graph leaves only the two configuration/URL consumers
above as apparent unused modules. Dependency candidates are `react-dom` (Next.js)
and `@tiptap/pm` (Tiptap’s required peer); neither is unused.

## Surface and environment boundaries

No persisted-data, domain, HTTP/MCP capability, permission or connection changes.
Both fixed OAuth identities, native audience, scopes, explicit consent, token
storage/rotation/revocation and personal credential isolation remain intact.
The MCP App needs no new UI for source/dependency retirement.

Before live tests, an in-memory check confirmed the existing isolated development
DB endpoint, loopback origin and reserved synthetic fixture accounts without
printing credentials. Local auth and Blob configuration were also confirmed distinct
from production in memory. No migration, provisioning, production data write, provider
configuration, secret deletion, release or installed-device operation was run.
Provider integrations in the integration suite use the existing mocks.

## Verification

Completed:

- `pnpm install --frozen-lockfile`: passed; no resolution update needed.
- `pnpm typecheck`: passed all eight child workspaces and root.
- `pnpm test`: all 119 tests across 25 discovered files passed, no skips/failures.
  `tests/editor-ordering.test.ts` preserves reorder/invalid-input and lossless-note
  cases. `tests/list-cache.test.ts` preserves deduplication, stale responses,
  revocation/sign-out, retry, independent revisions and bounded-retention cases.
- `pnpm build`: guide, MCP packaging and optimized Next.js build passed.
- `pnpm build:native:web`: TypeScript and Vite production build passed.
- All workspace and root tooling compiler diagnostics with `--noUnusedLocals`,
  `--noUnusedParameters` and `--incremental false`: passed.
- `node scripts/verify-contributor-guide.mjs`: passed at 320/390/1280px, including
  keyboard/navigation, downloads/hashes, retired paths and zero app API calls.
- Relative Markdown target scan and `git diff --check`: passed.

`pnpm test:integration` passed all 37 cases, with no skips/failures, against isolated
development services. After final tooling-import cleanup, the earlier affected GitHub
and list-feature suites were rerun: all four cases passed. The final unit rerun also
passed all 119 cases.

`node --env-file=.env.local --import tsx scripts/verify-list-workspace-ui.ts` passed:
Work/basic layouts at 320/390/1024/1280/1440/1920px, saved-view operations and
reloads, personal isolation, metadata saves/conflicts, exact retries and retained
notes drafts through layout changes. The synthetic phone and desktop screenshots
were visually inspected; local output is in `.vercel/mobile-task-first/`. Fixture
cleanup completed through the scripts’ existing finally handlers.

Native compilation/installation, device
accessibility/signing, production deployment and named-host MCP UI were not tested
in this cleanup. Vite still reports its large-chunk advisory; dependency resolution
reported upstream Neon Auth peer/deprecation warnings. No dependency upgrade or
warning suppression was introduced to address those separate issues.
