# Tauri migration cleanup audit

Date: October 24, 2026
Status: audit complete; implementation awaits maintainer scope approval.
Baseline: `cd9d49d` on `main`, initially clean.

## Request and instructions

Tim requested a full cleanup of unused Expo/React Native remnants, scripts, code
and outdated documentation now that Tauri is the chosen native client. This
explicit retirement request supersedes the earlier direction to retain Expo as a
reference. It does not establish that Tauri's installed-device gates have passed.

Active instructions are root `AGENTS.md`, `apps/web/AGENTS.md`, the repository
`wuff-contributor` skill and `docs/contributor-workflow.md`. Product, architecture,
implementation plan, development, verification, and guide product/design/
accessibility/surface rules were reviewed. A draft PR and Tim's `/wuff-scope`
approval must precede source/dependency implementation. No approval was posted
by an agent and no existing safeguard needs changing for this cleanup.

## Findings and proposed changes

### Retire the Expo workspace

`apps/mobile` contains 15 tracked files totaling 3,173,777 bytes, including a large
React Native application, Expo session adapter, app/EAS configuration, duplicated
fonts/branding and the public-origin example. It is still included by the workspace
glob and recursive typecheck. Root commands `dev:mobile` and `build:mobile` start or
export it. `scripts/verify-mobile-bundle.mjs` only validates its exports. No other
tracked TypeScript/JavaScript module imports an `apps/mobile` source file.

Remove these files and commands, regenerate the pnpm lockfile with pnpm 10.33.3,
and remove Expo-specific ignore/deployment exclusion rules. Keep ignored local
credentials and generated directories untouched. Git history retains the old app.
Do not relabel Tauri runtime/distribution gaps as completed by removing Expo.

### Remove obsolete forwarding modules

The TypeScript AST/import-resolution audit found 22 unused forwarding modules and
three forwarding modules used only by tests. Move those test imports directly to
the shared UI implementations, preserving all test cases, then delete these 25
modules:

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

An initial candidate, `apps/web/src/lib/utils.ts`, is referenced by
`apps/web/components.json` as the shadcn utility alias and must remain. This is why
an import graph alone is insufficient evidence for deletion. Likewise, keep the
forwarding modules that still have real application consumers.

### Consolidate dependency ownership

The web package still declares libraries now imported only by `@wuff/ui`:
`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`,
`@neon/realtime-react`, `@radix-ui/react-slot`, `@tiptap/core`,
`@tiptap/extension-list`, `@tiptap/extension-table`, `@tiptap/markdown`,
`@tiptap/react`, `@tiptap/starter-kit`, `class-variance-authority`, `clsx`, and
`tailwind-merge`. Verify shared-package/peer ownership during the frozen-install
and builds before removing these redundant web declarations. `@tiptap/pm` needs
peer-dependency review and, if necessary, explicit ownership in `packages/ui`.

`tests/editor-ordering.test.ts` currently imports MarkdownManager through
`apps/web/node_modules`. Move that test dependency to root development dependencies
and use its public import instead, so cleaning web dependencies cannot break the
regression suite. Keep `react-dom` in the web package: Next.js needs it despite the
absence of a direct source import. Keep Playwright in its existing owner; browser
scripts deliberately resolve it through the web manifest. Root CLI/type tooling
also has non-import consumers and is not established as unused.

### Remove compiler-confirmed unused bindings

An additional diagnostic run with `--noUnusedLocals --noUnusedParameters` reports:

- `jsonInput` and `sameOrigin` imports in the invitations GET route and list-sharing GET route.
- Two unused callback argument bindings in `apps/web/src/lib/mcp.ts`.
- `DashboardSection` and `githubSyncLabel` imports in the MCP App.
- `today` destructuring in the private TaskCell component.
- `detailed` and `onOpenTask` destructuring in Subtasks.

Remove unused bindings without changing public prop contracts, schema validation,
permission checks, callback behavior or rendered output. Do not enable stricter
compiler flags in CI as part of this cleanup.

### Repair current documentation

Update README, product specification, architecture, implementation plan and
current development commands to name `apps/native`, Tauri, shared UI and current
secure native storage. README/product/architecture still present Expo as the
chosen client, and development incorrectly says CI exports it.

Replace `docs/native-mobile.md` with a concise historical/retirement pointer that
keeps existing links valid. Update Tauri plan/platform/auth docs to distinguish
retired Expo frontend code from retained compatibility. Correct Tauri development
instructions that still say Cargo.lock is absent and Cargo has never been
available; preserve dated foundation evidence rather than rewriting it as current.
Update the work-task plan's current native pointer. Preserve dated verification
history, screenshots, old build counts and outstanding installed-platform gates.

Other stale product descriptions (for example first-release interaction wording)
need comparison with current shared source before editing. This cleanup's doc
scope covers confirmed native migration/command/status drift; broader product
redesign and historical evidence rewriting are excluded.

## Items checked and retained

- `/api/mobile`, its private image routes, `NativeClient`, contracts and native
  tests are used by Tauri. The name does not make them obsolete Expo code.
- `/oauth/native`, the old fixed client/callback constants and default client
  identity still have server, contract and regression-test consumers. Leave their
  compatibility/consent/revocation semantics intact; server-side retirement is a
  separate auth change, not an unused-code deletion.
- Every non-Expo script has a tracked executable or documentation reference.
  UI phase scripts remain regression/evidence tools; lack of a package command
  does not prove they are unused. Native release Python and manual native workflow
  are active tooling. No safeguard/workflow change is proposed.
- `packages/ui/src/live-updates.tsx` and its feature wrapper are both imported;
  they supply different layers rather than duplicate unused subscriptions.
- The reminder service worker is registered by URL, not an ES import. Keep it.
- `/prototype-kit/*` deliberately returns 410 with replacement guidance; old
  guide redirects preserve links. Keep these compatibility responses.
- Generated guide JSON is build input/output under the maintained guide workflow;
  keep it. No tracked node_modules, build caches, tsbuildinfo or logs were found.
- A relative-file-link existence scan of tracked Markdown found no missing local
  targets. This did not validate anchors, external URLs or historical accuracy.

## API, MCP, connections and environment

No persisted-data, domain, HTTP/MCP contract, authorization or connection changes
are proposed. Existing native audience, both fixed OAuth client registrations,
scopes, consent, token storage/rotation/revocation and personal credential isolation
stay intact. No MCP App UI change is needed for source/dependency retirement.
Unused import/argument removal in adapters must preserve existing behavior.

No database migration, environment retrieval, provisioning, production operation,
provider call, secret deletion, task mutation or device/release operation was run.
No preview/backend isolation is claimed. Additional integration writes require
confirmation of the documented isolated environment before execution.

## Actual audit evidence

- `git status --short`: initially clean; `main` at `cd9d49d`.
- `pnpm typecheck`: passed all nine child workspaces and the root, including Expo.
- `pnpm test`: passed all 119 tests across 25 discovered unit files; no failures,
  skips or cancellations.
- TypeScript compiler AST/resolution plus tracked-file string/config searches:
  the forwarding-module, dependency and Expo-consumer findings above.
- `pnpm exec tsc -p packages/ui/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters --incremental false`:
  exited 2 with the three unused UI bindings listed above.
- The equivalent diagnostic for web exited 2 with those UI bindings and eight
  web/MCP bindings; native exited 2 with only the three shared UI bindings.
  These were optional diagnostic flags; the normal required typecheck passed.
- Tracked script references, generated/cache filenames, relative Markdown file
  links and manifests were inspected. Static scans have false positives and do
  not prove runtime/platform readiness.

No source/dependency cleanup, post-cleanup build, browser smoke, API/MCP integration
or installed-device verification has happened in this audit-only commit.

## Acceptance and verification after approval

- [ ] Expo app, exclusive commands/export scanner and lockfile dependency graph are retired.
- [ ] The 25 obsolete forwarders are gone; shared-source regression tests retain every case.
- [ ] Redundant web dependencies are removed only after owning-package and peer checks.
- [ ] Compiler-confirmed unused bindings are removed without public behavior changes.
- [ ] Current native entry docs and commands consistently describe Tauri; historical evidence is labeled and retained.
- [ ] `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
      and `pnpm build:native:web` pass on the final source.
- [ ] Repeat import/config-reference and unused-binding diagnostics; review the full diff.
- [ ] Run relevant local browser/shared-editor and MCP packaging checks; record
      blockers and actual results without assuming build success proves runtime parity.
- [ ] Keep the PR draft until required verification is complete. Tim owns merge,
      production operations and installed-device/signing acceptance.
