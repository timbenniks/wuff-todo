# Implementation verification

Updated: October 25, 2026. Older sections retain their milestone-specific evidence and test counts.

## Todo appearance/menu follow-up — October 31, 2026

Tim’s local feedback restores the original themed light surfaces, with explicit
Light (default), Dark and System choices in the sidebar/task page and embedded
Todo. The choice is device-local and still works in the current document if
storage is blocked. No synced-data/API/scopes/consent changes. Dark remains tinted
by the list palette; all seven light/dark token contrasts pass. The photographed
list menu now uses named action rows and Move to… disclosure rather than a form
and unlabelled icons.

All 204 units, workspace TypeScript and optimized guide/MCP/web build passed.
Actual 27-task browser checks pass explicit Light over a dark OS, Dark/System
selection, reload persistence and the menu’s labels/progressive parent controls.
The updated navigation/real MCP Apps SDK suite passes, including two day-panel
customization controls, reorder/Cancel, no dead Favorites toggle, and post-write
read recovery. Unit cases verify day-panel move/reset preserves Favorites’ saved
visibility/position; this fixes Codex finding discussion_r4431682832.

[Light menu](screenshots/todo-productivity-list-actions-light.png) ·
[Dark menu](screenshots/todo-productivity-list-actions-dark.png).
Earlier test runs and managed-auth limits below remain scoped to their recorded
source; final follow-up drawer/adapter results are recorded in the PR.

## Todo productivity redesign — October 31, 2026

[Draft PR #45](https://github.com/timbenniks/wuff-todo/pull/45),
[component inventory, contract and detailed evidence](todo-productivity-redesign.md).
This follow-up supersedes the earlier list-first/favorite-expansion presentation.

- TypeScript, all **201 unit tests** (no skips), guide/MCP bundling and optimized
  web build passed. Tests cover simple-row defaults/explicit saved columns,
  260px resize defaults, seven-palette light/dark contrast, populated optional
  columns and inline payload/validation/list-isolation boundaries.
- Actual Chrome populated flow passed against loopback and isolated development:
  27 initial tasks/three sections, long titles, dates, completed items, subtasks,
  assignment and notes. Scoped/repeated inline creation, Enter/Escape/focus, exact
  lost-response retry without duplicates, filters/grouping/saved columns/reset,
  completion/reopening, notes dirty-exit/save, property focus, subtask/parent
  drawer navigation and origin focus/list scroll passed. Light/dark and
  320/390/1024/1366 Overview checks reported no page errors.
- Serial `tests/list-view.integration.test.ts`,
  `tests/list-favorites.integration.test.ts`, `tests/list-nesting.integration.test.ts`
  and `tests/todo-navigation.integration.test.ts` passed **all six cases**, no
  skips (72.3 seconds). Permissions, personal isolation, legacy preservation,
  stale/concurrent versions, exact retries, real HTTP/MCP scope/origin boundaries
  and revoked-connection rejection remain intact.
- A settings-portal hydration error was corrected; modal open/close/focus passed
  afterward. Separate repeat runs encountered existing managed-auth 503/429
  responses; failure preserved drafts. These failed runs are not counted as passes.

Representative rendered evidence: [workspace](screenshots/todo-productivity-workspace-light.png),
[dark workspace](screenshots/todo-productivity-workspace-dark.png),
[saved columns](screenshots/todo-productivity-workspace-columns.png),
[drawer](screenshots/todo-productivity-drawer-light.png),
[dark drawer](screenshots/todo-productivity-drawer-dark.png),
[Overview](screenshots/todo-productivity-overview-1366.png),
[phone Overview](screenshots/todo-productivity-overview-390.png).

Codex review identified a post-commit MCP catalog-refresh failure that masked a
successful write. The fix retains the authorized operation result, clears stale
navigation and offers a read-only refresh. The new regression failed against the
old helper (exit 1) and the fixed navigation unit file passed all eight cases;
all 201 units pass. The updated actual SDK browser suite passed this degraded-response recovery
after one real task write, with no page errors; backend exception text is not
returned. A separate current-source 27-task empty-drawer check passed at 390px,
including no drawer overflow and Escape/origin focus. Later complete dense-flow
repetitions encountered managed-auth 429 even with pacing; they are blocked, not
current-head full-suite passes. The earlier full flow remains separately recorded.

No production operations, migrations, new dependencies or scope/consent changes.
Physical-device, assistive-technology and human usability acceptance remain
separate from local viewport/keyboard proof; PR stays draft for review.

## QStash publisher ID regression — October 25, 2026

Included in [draft PR #35](https://github.com/timbenniks/wuff-todo/pull/35) at
Tim's request. [Failure/fix and evidence](qstash-scheduling-fix.md): the actual
SDK publishing regression failed before the fix on colon-separated headers and
passes with shared deterministic product/job/version/wake-minute hex IDs.
Typecheck, 224 unit tests, optimized build and all five relevant real isolated
integration cases passed. Rejection/unknown replies remain pending; identical
retries deduplicate in the simulated provider, while gates/pauses/six-day hops and
stale-version protection remain intact. No production retry/test send or manual
preview deployment. Live acceptance and browser receipt require distinct,
explicitly authorized checks after merge/deployment.

## Totake guarded web notification actions — October 25, 2026

[Draft PR #35](https://github.com/timbenniks/wuff-todo/pull/35),
[contract and full evidence](totake-notification-actions.md). Local TypeScript,
221 unit tests, optimized guide/MCP/web build and native frontend build passed.
Real isolated-development HTTP/MCP/native tests passed selected record/stock,
Undo, stale/expired/device/privacy/account guards, races and receipt replay.
The callback-payload case was repeated with a real callback and mocked sender.
Optimized Chrome proves four snooze durations, partial selection, exact retries,
Skip/Undo and narrow layouts; the existing Totake browser/actual MCP SDK host
regression also passed on a dedicated loopback port. No real push/provider or
physical phone/watch support is claimed. No schema or production configuration
changed. Hosted checks remain blocked by account billing, so the PR stays draft.

## Web push browser lifecycle — October 25, 2026

[Draft PR #34](https://github.com/timbenniks/wuff-todo/pull/34) and
[feature evidence](web-notifications.md) record standard subscription compatibility,
permission/reconnect/disconnect, safe Todo/Totake push/click handlers and private
key generation. Local typecheck, 207 unit tests, optimized build, two real
isolated-development integration cases and responsive Chrome checks passed.
OS PushManager/provider delivery is mocked; no real push receipt or production
configuration/release is claimed. Preview isolation and installed devices remain
separate gates. No schema, native permission, dependency or consent expansion.

## Empire Settings foundation — October 25, 2026

[Feature contract](empire-settings.md), [PR #25](https://github.com/timbenniks/wuff-todo/pull/25).
Verified implementation source: `10c91d074cac94a42f2e4ba44947e66f99cf1757`.
Local optimized app, real isolated-development services and synthetic accounts;
no production application release or installed-device acceptance is claimed.

- `pnpm typecheck` passed all workspaces and root scripts/tests. `pnpm test`
  passed **134 tests in 28 discovered files**, no skips. Six new settings unit
  cases cover defaults/unavailable summaries, patch omission/future preservation,
  invalid/duplicate/unknown inputs, explicit OAuth consent and unchanged defaults,
  expiry-aware grant summaries, and fixed/dynamic client revocation contracts.
  Three list-navigation cases cover unconfirmed versus confirmed destinations,
  history/query preservation and parameter injection. Existing portal and auth
  regression coverage remains. Targeted Prettier and `git diff --check` passed.
- `pnpm build` passed guide generation, MCP bundling and optimized web compilation.
  `pnpm build:native:web` passed the shared frontend; the existing >500kB chunk
  advisory remains. No dependency or native permission was added. Existing local
  root package/lock/workspace edits are excluded from the feature commits.
- `node --env-file=.env.local --import tsx scripts/verify-empire-settings.ts`
  passed global Settings without Todo catalogue requests, per-account app choices,
  all-hidden recovery, direct access to hidden Todo, independent dashboard choices,
  Cancel, conflict drafts, exact request/operation-ID retry after committed response
  loss, AI disconnect retry and actual subsequent revoked-token rejection. Legacy
  `/connections`/`#cursor`/listId and `/github` links, separate global device controls
  and Todo schedules, and 320/390/1280px layouts/overflow passed. An actual Next.js
  client transition from public Docs to Todo and Back proved private preference
  polling stops on the public guide, including focus refresh. No page errors.
- The same harness exercised the **actual MCP App in the local MCP Apps SDK host**:
  checkbox drafts do not write before Save, the server committed a response that
  was deliberately lost, retry used identical domain arguments/operationId, the
  UI acknowledged success and the database read matched the chosen value. The
  host-safe form handler is required because sandboxed hosts block native form
  submission. Screenshot was taken after confirmed success, not a pending state.
  This is not named ChatGPT/Codex-host certification.
- `scripts/verify-app-workspace-shell.ts` passed preserved Todo logo/history and
  desktop alignment, the new Settings/Docs shell and sticky navigation, phone
  selector/Lists Escape/focus, public/private boundaries and exact list-create
  response-loss retry inside Todo. The test exposed temporary list IDs entering
  history; the fix now keeps previews local until acknowledgement, with dedicated
  unit and browser regressions. Original earlier-milestone screenshots were restored.
- `scripts/verify-empire-portal.ts` passed existing authorized/anonymous/account
  isolation, real shared access revocation, bounded local-date previews, portal
  versus last-list startup, task/favorite/Overview/history navigation, menu keyboard
  behavior, account sign-out recovery and 320/390/1280px layouts. Its mocked
  empty/error responses remain clearly distinct from real successful reads.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/empire-settings.integration.test.ts tests/empire-adapters.integration.test.ts
tests/dashboard.integration.test.ts tests/dashboard-adapters.integration.test.ts
tests/reminders.integration.test.ts` passed **all 6 integration tests**, no skips.
  New cases call real HTTP, MCP and native bearer adapters in both write/read
  directions, read actual consent pages, test Empire-only/read-only/legacy grants,
  unchanged refresh authority, account/origin/audience rejection, stale/concurrent
  settings writes, idempotent retries and admission rejection on replay. AI clients
  are actor-private; attempting to revoke another actor's grant leaves it usable.
  Replaying an acknowledged disconnect does not revoke a newer explicit consent.
  Device removal was verified MCP-write/API-read and API-write/MCP-read; setup uses
  synthetic native addresses with no provider delivery. Existing dashboard and
  reminder authorization, lifecycle, scheduling and receipt regressions also pass.
  Harnesses restore preferences and clean fixture lists/devices/grants.

Migration execution was separately authorized by Tim's “just apply everywhere”
reply. Generated Drizzle `0018_empire_preferences.sql` was applied on the existing
isolated development **direct** connection, then domain retry/concurrency/isolation
tests passed. Production preflight confirmed a distinct direct connection and
that only 0018 was pending, with applied hashes matching local migration history.
Applied 0018 there, read back `user_id`, `version`, `apps`, and confirmed existing
account/list/task counts were unchanged. No auth-managed tables, provider setup,
production app-data fixtures or production app deployment were involved.

Reviewed screenshots: [desktop Settings](screenshots/empire-settings-1280.png),
[320px](screenshots/empire-settings-320.png), [390px](screenshots/empire-settings-390.png),
[current portal](screenshots/empire-settings-dashboard-1280.png), and
[confirmed MCP save](screenshots/empire-settings-mcp-390.png). Synthetic data only.

Required remote CI remains a separate gate; preceding runs did not start because
of GitHub account billing/spending limits. Keep the PR draft while those checks
are blocked. Preview backend isolation is unconfirmed, so no preview data writes
are claimed. Physical devices, installed native Settings handoff/delivery, screen
readers, live notification providers and named MCP hosts remain unverified.

## Wuff Empire portal — October 25, 2026

[Scope and decisions](wuff-empire.md), [draft PR #25](https://github.com/timbenniks/wuff-todo/pull/25).
Verified implementation source: `a684145f822fd53027d75e3749bff1b25ccfaa62`.
This is local development evidence, not production or installed-client acceptance.

- `pnpm typecheck` passed all workspaces and root scripts/tests. `pnpm test`
  passed **125 tests in 26 files**, with no skips. New
  `tests/empire-portal.test.ts` covers eight outcomes: route boundaries, safe
  sign-in destinations/default, section order/visibility without preference writes,
  explicit-date loading/success, failure clearing/retry, stale success after
  revocation, calendar rollover/late failures, and disposed account/page reads.
  `tests/work-tasks.test.ts` keeps redirect-attack regression coverage with the
  new portal fallback. Targeted Prettier checks and `git diff --check` passed.
- `pnpm build` passed guide generation, MCP bundle and optimized Next.js web.
  `pnpm build:native:web` passed TypeScript/Vite; its existing >500kB chunk advisory
  remains. No new dependency, schema, native permission or deployment setting was
  introduced. Pre-existing local dependency-file edits were excluded from the PR.
- Readiness checks confirmed the configured development database endpoint,
  synthetic fixture users, and distinct development/production database, auth and
  Blob credentials without printing their values. No preview isolation is assumed.
- `node --env-file=.env.local --import tsx scripts/verify-empire-portal.ts` passed
  against the optimized localhost app with real synthetic sessions/data. It checks
  anonymous root/Totake/list/task redirects, public guide independence, cross-account
  exclusion, account-pinned 409, five-task bounded previews/exact totals and local
  calendar date, real shared-list membership revocation, explicit portal versus
  last-list startup, task/favorite/Overview/history navigation, Totake coming soon,
  menu keyboard/Escape/focus return, Settings, sign-out failure/retry/success, and
  320/390/1280px overflow/desktop workspace geometry. The request-failure and empty
  responses were deliberately mocked; successful reads and access revocation used
  actual development services. Initial loading was checked with a delayed real read.
  No browser page errors were captured. Pending sign-out blur previously hid Retry;
  the harness reproduced that bug and now passes with the menu kept open.
- `node --env-file=.env.local --import tsx scripts/verify-app-workspace-shell.ts`
  passed existing overview/history, desktop brand/title alignment, Settings/Docs
  active navigation, independent scrolling, 320/390px focus/Escape and overflow,
  public/private boundaries, and exact create-response-loss recovery. Its existing
  screenshot files were restored to preserve the earlier milestone's evidence.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/dashboard.integration.test.ts tests/dashboard-adapters.integration.test.ts`
  passed all **3 integration tests**: actual web/MCP/native adapters, scope/origin/
  account/audience boundaries, shared preferences, authorized dated task/subtask
  projection/counts/favorites, independent preference revisions, retries and
  first-write concurrency. Disposable data/grants were cleaned and synthetic
  preferences restored by the harnesses.

Reviewed screenshots: [desktop portal](screenshots/empire-dashboard-1280.png),
[320px portal](screenshots/empire-dashboard-320.png),
[390px portal](screenshots/empire-dashboard-390.png),
[read recovery](screenshots/empire-retry-1280.png),
[desktop Todo](screenshots/empire-todo-1280.png),
[320px Todo](screenshots/empire-todo-320.png), and
[390px Todo](screenshots/empire-todo-390.png). All content is synthetic.

GitHub's `check` and `policy` runs for the initial draft did not start: run
annotations report failed account payments or a spending limit needing increase
([Verify](https://github.com/timbenniks/wuff-todo/actions/runs/40179356032),
[policy](https://github.com/timbenniks/wuff-todo/actions/runs/40179356017)). These
are incomplete remote verification, not passing CI. Keep the PR draft. Vercel Git
previews do not establish backend isolation; no preview data writes, production
release, installed native/device run, screen-reader review or named MCP-host UI
certification is claimed.

## Contributor autonomy — October 25, 2026

Tim requested removing repeated contributor approvals while safeguarding dangerous
operations. Root instructions, contributor skill/workflow, guide, copied starter,
PR template and metadata policy now permit independent iteration without hashed
briefs, approved file lists or size exceptions. Risky paths are review hints; Tim
retains final merge/release review and explicit operational authorization. See
[decision, test cases and remaining gates](contributor-autonomy.md).

Local typecheck, all 117 unit tests (including 25 policy cases), guide/MCP/web build
and contributor browser checks at 320/390/1280px passed. Three new autonomy cases
fail against the original policy. Generated downloads/hash manifests, clipboard,
keyboard/navigation and zero app API requests were verified. There were no product
data writes or changes to API/MCP/auth contracts. The GitHub runner was tested with
synthetic responses; hosted jobs remain blocked before steps by account billing.
The PR remains draft. No live activation, preview-backend isolation or production
release is claimed; earlier scope-approval protocol evidence below is historical.

## Tauri migration cleanup — October 24, 2026

See [cleanup decisions and inventory](cleanup-audit.md). The maintainer explicitly
overrode the contributor skill’s extra scope-approval step in this chat. The
cleanup removes Expo source/exclusive tooling, 25 obsolete forwarding modules,
15 redundant web dependency declarations and unused source/tooling/test bindings.
No public runtime behavior, OAuth/API compatibility or safeguard change is selected.

`pnpm install --frozen-lockfile`, `pnpm typecheck`, all 119 unit tests,
`pnpm build` (guide/MCP/web) and `pnpm build:native:web` passed. The pnpm graph has
386 fewer resolved package/version entries and no added versions. All workspace
and root compiler unused-local/parameter diagnostics passed. Regression tests
retain every case and now import actual shared implementations/public dependencies.

`pnpm test:integration` passed all 37 cases against existing isolated development
services, with no failures/skips. Coverage includes web/MCP/native adapter parity,
OAuth/PKCE/scopes/refresh/revocation, permissions, personal preferences, retry and
concurrent changes, mocked GitHub/Cursor providers, reminders, notes and private
images. After final import cleanup, the two earlier affected integration suites
were rerun: all four cases passed. Development DB/loopback/synthetic fixtures and
separate auth/Blob configuration were checked without printing credentials.

The existing contributor-guide browser check passed 320/390/1280px, downloads,
keyboard/navigation, compatibility paths and zero app API requests. Authenticated
workspace browser verification also passed at 320–1920px: Work/basic columns,
saved-view create/rename/select/delete and reloads, personal isolation, metadata
conflicts, exact retries and note-draft retention. Phone/desktop screenshots were
visually inspected; the existing harness cleaned up its synthetic lists. No migration, provisioning,
production write/deployment, installed-device/native compilation/signing or
named-host MCP UI test was performed for this cleanup.

## Contributor preview build failure — October 24, 2026

PR #22 deployment `D3koosgLtjQAnNxUEJ8L882AnAZN` failed because
`.vercelignore` removed the contributor skill required by `build:guide`.
The deployment log showed the removed file and an ENOENT at that exact path.
The ignore rules now admit only `.agents/skills/wuff-contributor/SKILL.md`
while excluding other agent skills/files. Local `pnpm check` passed TypeScript,
all 119 unit tests and the optimized guide/MCP/web build. Hosted packaging must
also be verified on the replacement Vercel preview; local builds alone did not
exercise the original exclusion.

The separate Actions job for commit `9878b20` failed before any steps because
GitHub reported failed account payments or a spending limit. This is an external
runner blocker, not a passing or executed test suite. The PR stays a draft.

## Contributor unit tests and instruction clarity — October 24, 2026

Root AGENTS.md now explicitly requires meaningful unit coverage for every changed
behavior, regression tests for fixes, boundary/failure cases and actual completion
evidence. Docs/style-only exceptions must explain why no behavior changes;
data-changing features cannot waive coverage. The skill, PR template and hosted
workflow carry the same requirements. Obsolete first-release timing was replaced
with a pointer to the current milestone. Root instructions remain under 5 KiB.

`pnpm test` now discovers JS/TS unit files recursively instead of maintaining a
manual file list. Integration suites, helpers, hidden directories and dependencies
are excluded. Python/native tests remain local language-specific gates. The PR
policy requires test declarations, actual added/updated unit files and results;
deleted or integration-only files cannot substitute. Instruction override files
are explicitly sensitive and need maintainer approval.

`pnpm check` passed TypeScript, all 119 tests and optimized guide/MCP/web builds.
New policy cases verify unit-file evidence, non-waivable data changes and invalid
exceptions; discovery coverage verifies new nested files and exclusion of live
integration suites. A temporary, unregistered failing unit case was discovered by
the real runner and made `pnpm test` exit nonzero; the fixture was removed. The
targeted eight-page guide browser check passed at 320/390/1280px without overflow,
page errors or app API calls. Clipboard remains an in-memory test stub.

Instruction discovery guidance was checked against official OpenAI documentation.
Loading instructions is not proof of compliance: client/workspace overrides,
permissions, required checks and human review remain distinct. No actual new-agent
compliance run or live GitHub protection/rejection proof is claimed. Existing
GitHub plan/runner and preview-isolation onboarding gates remain unresolved.

## Contributor API/MCP/connection completeness — October 24, 2026

Tim confirmed equivalent API/MCP capabilities for every persisted-data feature,
with explicit MCP App UI and connection impacts. Root instructions, product spec,
architecture, contributor skill/workflow, starter prompts and PR/brief templates
now require the surface contract in `docs/guide/surfaces.md` (`/docs/surfaces`).
This includes personal settings, authorized reads, shared domain services,
idempotency/conflicts and explicit connection scopes/consent/recovery/revocation
and credential privacy. MCP UI is implemented with evidence or explicitly not
needed; secure browser handoffs never expose tokens or privileged callbacks.

The policy requires one JSON declaration in every PR. It rejects incomplete
domain/API/MCP mutation mappings, unimplemented operations, absent adapter results,
unresolved MCP UI decisions and affected connections without verification. No-data
changes need an explicit explanation. Scope hashes bind capability mappings and
UI/connection decisions while allowing implementation status and test results to
evolve. Changing approved capability scope requires renewed maintainer approval.

`pnpm check` passed workspace/root TypeScript, all 115 tests and optimized
guide/MCP/web build. Seven additional policy cases cover required mappings,
adapter deferral, MCP UI evidence, connection verification, no-data contradictions,
invalid declarations and scope changes versus evidence-only updates. The guide
now has eight pages. This is validation of contributor requirements and metadata
checks, not new application API/MCP adapter or provider integration proof.
The targeted guide browser check also passed all eight pages at 320/390/1280px,
including the new surface guide, current download hashes and raw agent reference,
with no document overflow, captured page errors or application API requests.
GitHub protection/runner and preview-isolation gates remain unchanged.

## Implementation guide consolidation — October 24, 2026

Tim selected a single repository contributor workflow, superseding the standalone
prototype/design-handoff path. The guide and contributor skill retain early
interaction/iteration, product and permission rules, real component reuse, design
tokens, accessible layouts, decision/acceptance records and honest mock/evidence
boundaries. Root AGENTS.md routes to these rules; GitHub policy/review remain
separate enforcement. Maintained pages now live in `docs/guide/`.

- `pnpm check` passed workspace/root TypeScript, all 108 tests and optimized
  guide/MCP/web builds. The obsolete docs `@source` directive is removed and the
  final build no longer reports that CSS parser advisory. Policy coverage includes
  sensitive approval for the maintained guide and contributor skill.
- `pnpm build:guide` indexes the actual UI source. Its generated component inventory
  was structurally identical to the previous 48-component inventory. The removed
  Vite source kit, copied dependencies/lockfile, packaging script and prototype
  skill are not part of delivery. Guide TaskRow examples still import real code
  with synthetic local runtime callbacks and no private backend calls.
- Contributor skill validation passed. Every download matched its SHA-256
  manifest, the ZIP passed CRC checks and contained only the exact contributor
  SKILL.md. The retired generated public archive directory was absent after build.
- `node scripts/verify-contributor-guide.mjs` passed against the optimized local
  site: all seven pages at 320/390/1280px without overflow; starter copy with a
  clipboard stub, keyboard Enter, navigation, raw agent reference, component
  search and actual TaskRow completion; no captured page errors or app API calls.
  Old guide URLs returned 308 to Build/Review; old kit/skill downloads returned 410
  retirement messages. Initial page-level redirects produced duplicate Location
  headers on a cold request; explicit Next config redirects fixed this and the
  final compatibility checks passed. Phone/desktop screenshots were visually
  inspected: [phone](screenshots/contributor-guide-390.png),
  [desktop](screenshots/contributor-guide-1280.png).
- The obsolete local `wuff-prototype` skill was archived outside skill discovery
  with original files preserved; this does not update another person's installed
  skills. Existing shell/UX verification scripts now expect contributor resources.
  Their broader authenticated mutation scenarios were not rerun for this docs
  change; this is a targeted anonymous-guide/browser verification.

No production deployment, native/device check, actual contributor-agent session,
schema change or environment-isolation setup is claimed. GitHub plan/runner and
preview-isolation onboarding gates remain in [GitHub safeguards](contributor-github.md).
Earlier prototype evidence below is historical and superseded by this decision.

## Contributor GitHub safeguards — October 24, 2026

Expanded contributor delivery workflow and local evidence:

- Root instructions route real feature work to the canonical contributor workflow
  and repository skill. The hosted guide adds `/docs/build`, a separate starter,
  skill download, PR template and full workflow. Prototype-only behavior remains.
- A metadata-only trusted-main policy workflow validates maintainer-created scope
  approvals, brief hashes, changed/renamed paths, sensitive-file exceptions,
  current-commit evidence and large-diff approval. No PR code or dependencies run
  with its write-check token. Checkout/setup actions are pinned to verified v4
  commit SHAs. The prepared ruleset now requires `check` and `Contributor policy`.
- Final `pnpm check` passed workspace/root TypeScript, all 108 unit tests and the
  optimized prototype-kit/MCP/web build. Seventeen new policy cases cover forged
  approvals, revocation, stale brief/evidence, path traversal and rename escapes,
  sensitive paths, credential filenames, large/incomplete inventories, API errors,
  exact evaluated SHA and changes during evaluation. The existing docs `@source`
  CSS parser advisory remains; the optimized build completed successfully.
- Workflow YAML/permission/trigger/checkout inspection and ruleset JSON checks
  passed locally. Contributor skill validation passed. ZIP CRC and exact source
  byte checks passed for the contributor skill and workflow/template downloads.
- `node scripts/verify-contributor-guide.mjs` passed at 320/390/1280px against the
  optimized local website: one main heading, responsive navigation, copy prompt,
  keyboard Enter, downloads, raw agent reference, retained prototype resources,
  no document overflow, no page errors and no app API requests. Clipboard is an
  in-memory test stub. The first test caught long approval examples overflowing;
  scoped code-block wrapping fixed it. A harness label selector was corrected to
  the actual combobox accessible name. Phone/desktop screenshots were visually
  inspected: [phone](screenshots/contributor-guide-390.png) and
  [desktop](screenshots/contributor-guide-1280.png).
- No native compilation/device, actual contributor-agent run, production guide
  deployment or live policy rejection is claimed. The new privileged workflow
  must first land on main, then be exercised against a synthetic PR before
  protection activation/onboarding. Owner review remains necessary; upstream
  write access can also create similarly named Actions checks, so upstream read
  access plus private forks is preferred where supported.

Live `gh` reads confirmed private `timbenniks/wuff-todo`, ADMIN access, default
branch `main` and auto-merge disabled. Ruleset listing and main protection reads
both returned HTTP 403 requiring GitHub Pro or a public repository. No protection
was activated and repository visibility was preserved. Verify run 40093282223
reported zero job steps; check annotations identify billing/spending limits.
Actual required-check names and Actions app ID were read from main's check runs.

Prepared CODEOWNERS, contributor delivery guidance, a PR template and a ruleset
payload; see [activation and limits](contributor-github.md). File formatting,
JSON parsing and diff whitespace checks cover these configuration/documentation
changes. GitHub API acceptance of the payload and rejection of unauthorized
contributor pushes/merges remain unverified until the plan block is resolved.

CI simplification: automatic Verify now has one Ubuntu `check` job running
`pnpm typecheck` and `pnpm test`, with a 15-minute limit and superseded-run
cancellation. Both commands passed locally, including all 91 unit tests.
Native test builds is manual-only. The initial ruleset required only `check`;
the expanded contributor workflow adds the metadata-only `Contributor policy`.
Workflow YAML parsing and trigger/job inspection, JSON parsing, formatting and
whitespace checks passed. This is local configuration evidence; remote Actions
execution remains subject to the account billing block. No native compilation,
manual workflow dispatch or release publication was performed for this change.

## Personal Home dashboard — October 23, 2026

[WUFF-87](home-dashboard.md) adds a configurable personal Home: welcome/Waffles, Today, seven-day Coming up and Favorites. Settings control section order/visibility, reset and Home/last-list entry. Task previews preserve list/shared/parent context. Direct task/list links, authorization and shared revisions remain independent.

- 89 unit tests passed, including local calendar/leap/DST/year-limit windows and validated section settings. Workspace/root TypeScript, optimized web/MCP build and native frontend build passed; native output retains its existing bundle-size advisory. After the embedded form-handler correction, the MCP bundle and root/web TypeScript checks also passed.
- Two new isolated-development domain integration cases passed: authorized bounded previews and exact totals, independent subtasks beneath a completed parent, no notes exposure, personal favorites, archive/restore/revocation, unchanged list snapshots/sidebar versions, preference isolation, validation, first-write concurrency, stale versions and idempotent retries. An authenticated adapter case passed HTTP/MCP/native preference persistence and read-only/origin/account/audience/invalid-date boundaries.
- `scripts/verify-home-dashboard-ui.ts` passed against the optimized website. It covered task-page navigation, shared labels, hide/reorder/save/reload/reset/all-hidden, last-list entry and explicit Home, Back/Forward, archived last-list fallback, unchanged other-account preferences, exact-payload retry after a committed response was lost, retained drafts on conflict and explicit reload recovery, failed-read clearing/Retry, and long task names. At 320/390/1280px neither the document nor Customize dialog overflowed; no page errors were captured. Screenshots: `home-dashboard-{320,390,1280}.png` and `home-dashboard-customize-{320,390,1280}.png`.
- A real local MCP Apps SDK host passed Home data, hide/reorder/save/reload/reset, opening existing task content, returning Home, and 390/1280px layouts without page errors. Its form uses Wuff's sandbox-compatible explicit click/Enter handler; native form submission is blocked by this test host. Screenshots: `home-dashboard-mcp-{390,1280}.png`. This is local SDK-host evidence, not a named production ChatGPT/Codex or physical-device certification.
- Additive migration `0017_tiresome_dreadnoughts.sql` applied on isolated development through the existing direct connection, preserving pre-existing user/list/task/member and checked sidebar field fingerprints. Development lists and SDK grants were cleaned up; synthetic dashboard/sidebar preferences were restored. Production migration also preserved exact existing user/list/task/member/sidebar fingerprints (2 users, 9 lists, 50 tasks, 2 memberships and 2 sidebar rows).

Production source `07ea4be` was committed/pushed. CLI deployment `dpl_AEiWJMtebmzsubVPX8CPnW4DNRns` is Ready, serves the canonical URL and has `fra1` outputs. Authenticated production Chrome verified dated previews, list/parent context, favorites, layout hide/reorder/save/reload, last-list entry, explicit Home and reset, with no captured console errors. An independent domain read confirmed exact task/subtask snapshots. The disposable list was deleted, original visible sidebar/Home settings restored, and all pre-existing user/list/task/member fingerprints matched before WUFF-87 was marked done. Screenshot: `docs/screenshots/home-dashboard-production.png` shows the disposable data used for that smoke. The new MCP tools require a client catalog refresh; no named production AI-host dashboard interaction is claimed. GitHub Verify 40029099216 and Native test builds 40029099073 failed before steps ran due to the account billing/spending limit. Local checks and Vercel build passed; updated downloadable native artifacts and installed-device checks remain separate.

## Personal list favorites — October 23, 2026

[WUFF-86](personal-list-favorites.md) adds personal shortcuts above the regular list tree, with add/remove in list settings, unchanged hierarchy/tasks/sharing and editor support. Archived favorites are hidden until restored; current access filters revoked/deleted lists.

- Workspace/root TypeScript, 87 unit tests, optimized web/MCP build and native frontend build passed. Native output retains its existing bundle-size advisory; installed native clients were not tested.
- The new favorites domain integration case passed, plus all five existing list-feature/nesting cases in a separate serial run (61.2 seconds). Coverage includes isolation, editor access, duplicate/inaccessible references, legacy payload preservation, retries, concurrent writes against nesting/collapse, unchanged task/subtask snapshots and shared versions, archive/restore, revocation/deletion, live order invalidation, and authenticated HTTP/MCP/native field persistence and scope/origin/account/audience boundaries.
- `scripts/verify-list-favorites-ui.ts` passed against the optimized isolated-development website: add/remove/reload, collapsed-child shortcuts, shared cues, personal isolation, unsaved owner draft preservation, identical-payload retry after a committed response was lost, archive/restore and editor controls. At 320/390/1280px no document/dialog overflow or captured page errors occurred. Screenshots: `list-favorites-{320,390,1280}.png` and `list-favorites-settings-{320,390,1280}.png`.
- A real local MCP Apps SDK host passed favorite save/reload, collapsed-child shortcut navigation, removal and 390/1280px layouts without page errors. A follow-up reproduced a stale catalog after another client had already starred the list; Add to favorites preserved the explicit add intent rather than toggling it off. The MCP build and root TypeScript passed after this correction. Screenshots: `list-favorites-mcp-{390,1280}.png`. This is local SDK-host evidence, not certification of every production AI host.
- Additive migration `0016_icy_umar.sql` applied through existing direct connections on development then production. Exact before/after fingerprints preserved original users/lists/tasks/members and every old sidebar field (including nesting/collapse). Production preserved 2 users, 9 lists, 50 tasks, 2 memberships and 2 sidebar preferences. Disposable development lists and SDK grants were cleaned up. Production smoke lists were also deleted; exact pre-existing user/list/task/member fingerprints matched the migration baseline afterward. Current visible sidebar preferences were preserved/pruned.

Application `141ea65` was pushed to main and deployed through Vercel CLI as `dpl_BVCaKqaiUQCYYPe2uC971bfjnbpi`. Authenticated production Chrome passed add/reload, child shortcut navigation with a collapsed parent and remove, without captured console errors. The live Codex MCP connection returned the same saved favorite, and a separate domain reread confirmed unchanged child tasks/subtasks and independent parent content. Screenshot: `docs/screenshots/list-favorites-production.png`. Follow-up `fc6b413` corrects the stale MCP action. Final CLI deployment `dpl_8VeAw5P78reKfM4UdL5HdZWQvXxw` is Ready, serves the canonical URL and has `fra1` outputs. Production shared-list editor settings also expose favorites without owner archive/metadata controls. Screenshot: `docs/screenshots/list-favorites-settings-production.png`. WUFF-86 was marked done after the production checks and cleanup. Verify run 40023697961 and Native test builds 40023697929 failed before steps ran because GitHub reported the account billing/spending limit. No remote CI success or updated native binary is claimed.

## List settings and archive placement — October 23, 2026

The shared web/Tauri sidebar now contains lists and their collapse/reorder controls, with Archive browsing in the footer beside account Settings. Personal nesting is inside the selected list’s **Settings → Your sidebar → Parent list / Move list**. Owner-only Archive list / Restore list actions remain inside list settings. Location saves stay in the dialog and preserve unsaved owner metadata drafts.

Workspace/root TypeScript, optimized web/MCP build and native frontend build passed. The updated `scripts/verify-list-nesting-ui.ts` passed against the optimized isolated-development application: settings-scoped nesting, collapse/reload/sibling ordering, exact-payload retry after a committed response was lost, unchanged owner drafts, archive/restore browsing and editor visibility without owner controls. At 320/390/1280px, Archive followed the list navigation and neither sidebar nor settings overflowed. Updated screenshots are `docs/screenshots/list-nesting-{320,390,1280}.png` and `list-nesting-move-{320,390,1280}.png`. No schema, domain permission or MCP contract change was needed. Production source `6d4f595` was committed/pushed and deployed through Vercel CLI as `dpl_FXqSrYC9RKGrbv4MrMNvQZDFs9nX`. The deployment is Ready on the canonical URL with `fra1` outputs. Fresh authenticated Chrome confirmed no Move list button in the sidebar, Archive below the list navigation, personal location controls inside list settings for an editor, and the owner-only Archive list action still present for an owned list. No captured browser errors or production data mutations were needed. Screenshot: `docs/screenshots/list-settings-location-production.png`. GitHub runners remain blocked by the previously reported account billing/spending limit; Vercel build passed.

## Personal list nesting — October 23, 2026

[WUFF-85's contract and release boundary](personal-list-nesting.md) implements one-level personal sidebar nesting across web/shared Tauri features, HTTP/native adapters and MCP/MCP Apps. Parent lists keep their own tasks; task/subtask structure, list membership and shared revisions are unchanged.

- `pnpm typecheck`, `pnpm test` (87 passing tests), optimized web/MCP `pnpm build` and `pnpm build:native:web` passed. The native frontend retains its existing bundle-size advisory; no installed native build or device test was run for this feature.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1 tests/list-nesting.integration.test.ts tests/list-features.integration.test.ts` passed all five cases in one serial run (81.5 seconds). Coverage includes personal isolation, editor organization, unauthorized parent references, cycles/depth/duplicates, read-only scope denial, optimistic concurrency, idempotency, legacy payload preservation, archive/revocation/deletion promotion, exact task/subtask preservation, and the existing live order-version signal. Authenticated loopback web/MCP/native checks covered origin and account pinning, shared persistence, stale revisions and audience boundaries.
- `node --env-file=.env.local --import tsx scripts/verify-list-nesting-ui.ts` passed against the optimized local website: move under a parent and back to top level, collapse/expand with a selected child, sibling position picker, parent-with-children restriction, reload persistence, parent-only task content, and an aborted response after a committed save. The retry sent the exact same body/operation ID and recovered. Measured 320/390/1280px sidebar/dialog layouts had no document overflow or captured page errors. Screenshots: `list-nesting-{320,390,1280}.png` and `list-nesting-move-{320,390,1280}.png` in `docs/screenshots/`.
- The real local MCP Apps SDK host exercised nested catalog rendering, persisted collapse/expand, moving a child to top level and reparenting. Its narrow iframe had no overflow or page errors; screenshots are `docs/screenshots/list-nesting-mcp-{390,1280}.png`. This is local SDK-host evidence, not a named production ChatGPT/Codex-host certification.
- Additive migration `0015_swift_randall_flagg.sql` was applied only to the existing isolated development branch using a direct connection. Original list/task/member rows and old preference values matched before/after migration fingerprints. Disposable fixture lists were deleted, the SDK-host grant revoked, and final list/task/member fingerprints matched the pre-migration data. Synthetic sidebar revisions advanced during testing; their visible preferences were restored.

Production follow-up: application commit `ba160b1` was pushed to main. Migration 0015 applied through the direct Vercel-managed production connection, preserving the original 2 users, 9 lists, 50 tasks, 2 memberships and 2 preference records. CLI deployment `dpl_9ouUyX4AmeHu7XLdhRkg1ybV696E` is Ready, serves the canonical URL and has `fra1` outputs. Authenticated production Chrome saved a disposable child under a parent, reloaded the hierarchy and collapsed/expanded it without captured browser errors. The live Codex MCP `get_list_order` returned that same nesting. An independent domain reread preserved exact child task/subtask snapshots and parent-only content. Both test lists were deleted and confirmed inaccessible; current visible sidebar preferences were preserved/pruned, and all pre-existing user/list/task/member fingerprints matched before marking WUFF-85 done. Anonymous list API/MCP returned 401 and sign-in returned 200. Screenshots: `docs/screenshots/list-nesting-production.png` and `docs/screenshots/wuff-85-production-done.png`.

GitHub [Verify 40020000501](https://github.com/timbenniks/wuff-todo/actions/runs/40020000501) and [Native test builds 40019999828](https://github.com/timbenniks/wuff-todo/actions/runs/40019999828) failed before any steps ran: GitHub reported recent account-payment failures or a spending-limit block. This is not remote passing-test evidence. Local checks/Vercel build passed; updated native downloads and installed-device verification remain separate gates.

## Accumulating list actions — October 23, 2026

The shared web/Tauri list header gave sibling SharingDialog and ListSettings components the same list-ID key. Switching between cached lists left orphaned sharing triggers in the DOM. Keys now include the control name and list ID, preserving dialog reset on list changes while keeping sibling identities unique.

A local headless Chrome harness rendered the actual ListApp with three synthetic in-memory list snapshots (two owned and one shared). Across 24 sidebar switches, the original keys produced 26 direct action buttons and 25 duplicate-key warnings. With distinct keys, every selection retained exactly one Share/People trigger, one Settings trigger and an owner-only Delete trigger, with no browser errors or console errors. Workspace/root `pnpm typecheck` and optimized web/MCP `pnpm build` passed after restoring missing workspace dependency links with a frozen-lockfile install. This is local component/browser evidence; production and installed native clients were not exercised or deployed.

## Tauri shared workspace — October 22, 2026

PRs #12–15 passed remote web/Expo regression and macOS/Windows compile checks before merge. Locally, all 74 unit tests and all 28 development integration cases passed. Packaged macOS authentication, live connection and core editing/image checks are recorded in [auth](tauri-auth.md), [live transport](tauri-live.md) and [shared features](tauri-features.md). The same native-created private image loaded in the website reader/editor; 320/390px document widths had no horizontal overflow. Native test fixtures were removed and the synthetic native session signed out. Production Vercel status for core merge `862e278` is successful; unauthenticated native image access returns 401. This is deployment/boundary evidence, not an authenticated production-device test.

See [platform matrix](tauri-platforms.md) for build artifacts, browser handoffs and outstanding installed-device/signing gates.

## Pre-mobile hardening — October 18, 2026

See [the checkpoint](pre-mobile-checkpoint.md) for the five selected deliverables, exact test/run boundaries, real Tim/Joreel reports and MCP confirmation, optional native GitHub consent, phone UI measurements and agreed native notes/images release requirements. The current local release checks include 49 passing unit tests, TypeScript, web/MCP builds, native exports/bundle scans and all 24 distinct integration cases across an initial run and the five-case auth rerun. Source/deployment and physical-phone evidence are recorded there.

## Automatic GitHub issue creation — October 18, 2026

[Feature evidence](github-sync.md#automatic-issue-creation--october-18-2026) records the owner opt-in, transactional task/link/job, existing two-way notes/description and completion contract, migration and release boundaries. Workspace/root TypeScript checks, 48 unit tests and optimized web/MCP builds passed. The expanded provider-mocked GitHub integration passed against the existing isolated development database, including simultaneous duplicate requests and lost-response recovery. Additive migration `0010_motionless_blink.sql` was applied to development then production, preserving exact existing list/task/membership hashes (2/1/1). The user selected the existing test repository for Tim’s work and automatic creation is enabled there. The production smoke uncovered worker contention/pooling lock handling; a transaction-scoped lock and lease-retry correction passed the expanded isolated integration and final TypeScript/build checks. See the feature document for final deployment/live evidence.

## Native mobile development — October 17, 2026

See [native mobile](native-mobile.md) for the new local Expo slice, separate authorization audience, secure storage, online-only boundary and device/distribution gates.

- `pnpm check` passed: all workspace/root TypeScript checks, 48 unit tests and optimized web/MCP builds. Nine new unit tests cover native audience/redirect policy, single-flight token rotation, late responses/refreshes after sign-out, invalid grants, secure-storage failures and exact-payload ambiguous-write retries. The final mobile refresh adjustment was additionally typechecked and exported after this full check.
- `pnpm test:integration` passed all 24 isolated-development tests in one serial run (273.6 seconds). Two new real HTTP/native OAuth cases cover system-browser authorization protocol, separate audiences, strict callback/resource policy, failed PKCE, single-use codes, private/shared permissions, owner-only management, membership revocation, safe creation retries, stale writes, read-only grants, denied GitHub scope, refresh rotation/replay and connection revocation. Existing MCP tests also prove an MCP bearer cannot authorize the native adapter. These are synthetic protocol tests, not an installed browser-to-app callback or Keychain/Keystore test.
- `pnpm build:mobile` exported final iOS and Android Metro/Hermes bundles with source maps. The automated graph check found no web/server/domain/database modules or selected local secret values. This is a bounded packaging check, not a general security certification. CI now includes the same export/check command; inspect the remote run after pushing this change before claiming remote CI passed.
- `expo install --check`, frozen-lockfile installation and Expo native config introspection passed. Introspection confirmed identifiers, registered iOS callback scheme, SecureStore plugin and Android HTTPS transport default. Local HTTP is enabled only when building for a loopback backend; installed native transport behavior is still unverified.
- Native synthetic list deletion was independently reread as not found; native owner/editor/read-only grants were revoked. No production database migration, deployment, real-user task/list mutation, EAS registration/build or store submission was performed. Existing web production release evidence below remains dated evidence for its recorded source.
- The machine has only Xcode Command Line Tools and no available Android `adb`; neither simulator nor device app execution, native visual/keyboard/accessibility review, secure device-storage behavior nor a signed binary is certified. The next gate is an installed development build with the scenarios in [native mobile](native-mobile.md).

## Latest design release

Source `4c80aea` passed [CI 39016658429](https://github.com/timbenniks/wuff-todo/actions/runs/39016658429); select/disclosure refinement `c9578d9` passed [CI 39016981432](https://github.com/timbenniks/wuff-todo/actions/runs/39016981432). Local evidence covers 36 unit tests, 21 integration tests for the design implementation, optimized builds/typecheck, seven palettes, responsive web/MCP, DM Sans upright/italic loading and targeted view-control save/keyboard checks. These were separate bounded runs, not one uninterrupted full suite after every styling change.

October 17 inspection matched the GitHub deployment record for `c9578d9` to Vercel `dpl_DrbqkELJ6K5PpEBKrqXSMYvUs7es`, Ready with canonical production alias and `fra1` function output. This establishes deployment metadata, not authenticated production usability. No new production writes or physical-device tests were performed in this documentation pass. See [design release and limits](design-language.md#source-and-deployment-status).

In this chat, Wuff MCP tools were absent from the exposed tool catalog and plugin discovery found no Wuff entry. That is a session capability limitation, not evidence that the deployed MCP endpoint is down. Historical SDK/protocol checks and user reports remain separate from a live named-host check.

## Implemented milestone

October 17 design language and list themes: [implementation and fresh evidence](design-language.md) records the shared web/MCP action/status system, responsive layout repairs and seven list-driven app palettes. Local implementation checks are distinct from production, named-host and physical-device verification.

October 17 work-task foundation: [delivery plan and evidence](work-tasks-plan.md) records the selected pre-native sequence, shared web/API/MCP implementation, 29 unit tests, 20 live development integration tests and responsive browser/SDK-host checks. This historical Stage 1 evidence predates the now-released GitHub sync; agent execution remains deferred.

October 17 auth rendering fix: see [session reads during server rendering](auth-rendering.md) for the production cookie-write failure, read-only page adapter, preserved Route Handler renewal and current regression/release evidence.

The initial technical foundation includes the pnpm monorepo, Next.js web application, managed Neon email/password login, application admission, Drizzle migrations, shared list/task services, a session-authenticated HTTP API, delegated OAuth for MCP, MCP tools, and an embedded MCP App.

Existing-account invitations and sharing UI/API/MCP are now implemented; the sharing section below records their verification. Waffles branding verification is in [mascot details](waffles-mascot.md). Personal sidebar ordering and archive/restore are now implemented with list colors/descriptions and sections; see the mature lists section below. New-account invitation delivery, full external-client validation, and mobile authentication remain open. Tim reported successful activation and use; independent verification of both real users remains incomplete.

## Automated evidence

- Workspace and root TypeScript checks pass.
- Twelve unit tests pass (contracts, OAuth redirect policy, list cache races, session failures, and live refresh queues).
- Thirteen live integration tests pass against the isolated development branch (including sharing, live updates, and mature lists); earlier milestones contained seven to ten.
- The Next.js production build passes, including MCP App bundling.

The integration tests cover private-list isolation, admitted versus unadmitted identities, owner-only management, shared task writes, membership revocation, disabled users, idempotent retries, stale versions, task reordering, and completion/reopening.

HTTP/MCP tests cover Neon login, session restoration, logout, denied public signup at the proxy and managed email/password endpoint, unauthenticated requests, OAuth discovery, explicit consent, PKCE rejection, resource mismatch, one-time authorization codes, MCP initialize/tool discovery, cross-surface writes, MCP UI resource retrieval, read-only scopes, refresh rotation, and connection revocation.

Password activation/recovery tests cover origin and method restrictions, strict payload validation, normalized email, unknown and disabled account gating, a managed expiring OTP challenge for a reserved synthetic address, and rejection of incorrect codes without changing credentials. Successful code redemption and real mailbox delivery have not been verified. The activation page was visually inspected in the local browser.

## Browser evidence

Manual browser checks used synthetic users and the development database:

1. Opened the authenticated web list and added a task.
2. Opened the embedded view in a local host using the official MCP Apps SDK.
3. Observed the newly added task in that view.
4. Completed the task in the embedded view and observed the completed count on the website.
5. Inspected the layout at a 390-pixel viewport and checked for horizontal overflow.

Screenshots:

- [Web desktop](screenshots/web-desktop.jpg)
- [Web mobile](screenshots/web-mobile.jpg)
- [MCP App test host](screenshots/mcp-app.jpg)

The browser test host is real protocol integration evidence, not a claim of testing named hosts. Subsequent production checks through Codex CLI's MCP runtime are recorded in [MCP validation](mcp-validation.md). ChatGPT, Claude, Cursor, and inline rendering in a named host remain unverified. Automated accessibility certification and a full manual keyboard/screen-reader review have not been completed.

Slow-save and retry browser checks, latency findings, and region corrections are recorded in [performance](performance.md). The user subsequently reported that account activation and production web usage work; this is not independent verification of both recipients' accounts.

## Production boundary

Production is deployed at [wuff-todo.vercel.app](https://wuff-todo.vercel.app), with its own application schema and managed auth branch. Vercel reports the initial deployment ready, with functions in Frankfurt. Production smoke checks confirm the sign-in page returns 200, unauthenticated API and MCP requests return 401, the signup proxy returns 403, and OAuth discovery advertises the production origin.

The two requested real identities and enabled application profiles are provisioned through the operator command. No real passwords were chosen or displayed by the agent. The user reported successful activation and production web usage, then completed Wuff sign-in and OAuth consent for Codex. Authenticated production MCP discovery, reads, controlled writes, idempotent retries, and UI resource delivery passed through the Codex runtime. See [MCP validation](mcp-validation.md) for evidence and limits. Independent activation/connection for the other recipient, custom SMTP, production refresh/revocation, and real-host interactive UI still need verification.

## Existing-account sharing — October 15, 2026

- `pnpm check` passed: workspace/root TypeScript checks, 9 unit tests, and optimized Next.js production build.
- `pnpm test:integration` passed all 9 tests against the isolated development branch and local Next.js. The expanded OAuth/MCP integration test was rerun after adding full sharing-tool lifecycle checks and passed both tests in that file.
- Domain sharing checks include admitted recipient binding, pre-acceptance isolation, expiry, cancellation/decline, duplicate invites and acceptance, owner-only membership management, leaving, read-only scopes, acceptance retries after revocation, cancel/accept races, and task-write/revocation races.
- Authenticated HTTP/MCP tests use separate synthetic Alex/Sam sessions and OAuth grants. They verify invitation creation via MCP and web, web and MCP acceptance, shared MCP task writes, owner-only actions, web/MCP revocation, leaving via MCP, cross-origin rejection, and immediate denial with the former member's still-valid MCP token.
- Browser QA used synthetic users: owner invite, recipient inbox/acceptance, editor task creation, owner member removal, and loss of the list from the recipient's account. Desktop and 390px layouts were inspected; no horizontal overflow at phone width. Escape closed the modal and restored focus to the triggering button.
- Migration `0001_free_wild_pack.sql` was reviewed and applied to isolated development, then the Vercel-managed production database using its direct connection. Production had zero existing invitation records; migration adds nullable lifecycle columns and indexes, without deleting lists/tasks or modifying auth-managed tables.
- Screenshots: `docs/screenshots/sharing-desktop.jpg`, `invitation-mobile.jpg`, and `sharing-mobile.jpg`.
- Joreel's independent production account/connection remains unverified. No real user's list was shared during validation. Sharing UI is on the website; MCP sharing tools return structured results, while the existing MCP App continues list/task controls.

Production follow-up: sharing commit `77b120b` deployed through the Vercel CLI as `dpl_DmR9x75UwoqSnRe4yGsee7418jmx`, READY with function region `fra1`; GitHub run `38799561222` passed. The connected Codex MCP catalog exposed 18 tools. Direct authenticated production calls verified `get_list_sharing` and `list_invitations`, rejected self-invitation without changing the list version, and returned the same list on an identical create retry. The disposable production list was deleted and a subsequent read returned not found. No real list membership was changed. These production checks use Tim's connection; two-user sharing was validated with synthetic users in development, not Joreel's production account.

## Live list updates — October 16, 2026

Neon Realtime was enabled on the existing Vercel-managed isolated development and production branches, with separate credentials and explicit localhost/production browser origins. No application schema migration was needed. `pnpm check` passed (12 unit tests, TypeScript, production build) and `pnpm test:integration` passed all 10 tests, including live authorization, membership revocation, disabled admission, renewal, dropped-transport recovery, private/shared MCP writes, and rejection of old-account API requests. Browser checks confirmed shared/private MCP changes, retained task input, removed access, and a 390px layout without horizontal overflow. Synthetic browser fixtures and known orphan test lists were cleaned up. See [live updates](live-updates.md) for implementation details and verification limits.

Production commit `4801c96` deployed as `dpl_72gxhWiTda6B2ep7Jwzx9LHgeewy`, READY in `fra1`; GitHub CI run `38881911297` passed. The production stream delivered disposable list creation, task addition/completion, capability renewal, and deletion through trusted server domain services. The fixture was removed. This verifies the production Realtime configuration and domain path, not a production browser session or authenticated remote MCP request. The saved Codex refresh grant was rejected with `invalid_grant`; reconnecting that client and testing actual ChatGPT remain outstanding.

## Mature lists — October 16, 2026

Personal sidebar order, shared owner-controlled colors and plain-text descriptions, list sections, and owner archive/restore are implemented across web/API/MCP. `pnpm check` passed (12 unit tests, TypeScript, optimized build) and `pnpm test:integration` passed all 13 development tests. Browser checks covered the real local MCP Apps bridge and website, live metadata, draft preservation, archive/restore, personal order, keyboard dismissal/focus, and a measured 390px layout. The additive migration preserved production list/task/membership counts. Full evidence and remaining client/device boundaries are in [mature lists](mature-lists.md#verification-evidence--october-16).

Production follow-up: commit `6d8df84` deployed through Vercel CLI as `dpl_4ZE1SEaP8fCQk9emWpV9cZB54Vm1`, READY in `fra1`; GitHub CI run `38887845346` passed. An authenticated production browser saved color/description, created a section/task, and archived/restored its disposable list. Persisted state and the new production live query were checked through trusted server services; the fixture was deleted and disappeared from reads and the stream. Existing real lists/membership were untouched. Production remote MCP and actual ChatGPT checks remain outstanding.

## Inline name editing — October 16, 2026

List, section, active-task, and completed-task names now use inline fields on the website, with corresponding MCP App controls. `pnpm check` passed (12 unit tests, TypeScript, optimized build); the final build passed again after phone spacing and MCP form-label refinements. Synthetic browser tests covered Enter/Save, Escape/Cancel, focus restoration, whitespace rejection, completed-task persistence, MCP task/section renames, and a remote rename preserving a web draft with an explicit conflict notice. The final phone editor measured 300px within a 390px viewport/document, with no horizontal overflow. No schema, API, OAuth-scope, or permission change was needed. The preceding 13-test integration run remains historical backend evidence; it was not rerun for this UI change. See [inline-name behavior and screenshots](mature-lists.md#inline-name-editing--october-16-2026).

Production follow-up: `6e37d1c` deployed as `dpl_29H5pFgX8tzMtgDqCmtoKm9AxF9s`, READY in `fra1`; GitHub CI run `38889933109` passed. The existing production browser session opened the inline list-name field and cancelled an unsaved draft with Escape, restoring focus with no native dialog. Production data was not renamed. The synthetic development fixture list/grant were cleaned up.

## Task notes and corgi copy — October 16, 2026

Canonical Markdown task content, a lazy-loaded Tiptap web editor, shared safe rendering, an MCP App source editor/preview, and playful corgi guidance/feedback are implemented. Private image uploads were explicitly deferred by the user. `pnpm check` passed with 16 unit tests; the existing 13 development integration tests and the new content integration test passed. Browser checks covered web/MCP content roundtrip, concurrent draft preservation, stale-save recovery, completed-task drafts, source fallback for unsupported content and a 390-pixel layout without document overflow. Migration `0003_strange_dark_phoenix.sql` was applied on development then production, preserving record counts. Full evidence and named-host limits are in [task content and voice](task-content.md).

Release evidence: source `be0e81814dab085a1b3284cc689b34a36997a14a` passed GitHub checks and Vercel build; CLI deployment `dpl_JBSnyEyKJLKrUFLjCu3REAYifHQG` is READY in `fra1` and aliased to the canonical production URL. Authenticated production web editing/rendering and exact persistence passed with a disposable synthetic task, which was then removed. Unauthenticated list API/MCP remain 401; sign-in/discovery remain 200. Authenticated named AI clients remain a separate check for these new content fields.

## Direct task controls — October 16, 2026

Website Edit/Notes icons now open editing directly beside Delete, with a single Tiptap editor and internal Markdown storage. Task, section and personal sidebar arrows are replaced with pointer/touch and keyboard drag handles. The section picker is inside task editing and saves with its name. Nineteen unit tests, TypeScript and optimized builds passed, with live browser/API checks of direct editing, stored rich text, ordering persistence, Escape cancellation, focus restoration, MCP-triggered completed-task draft retention, safe older-content preservation, and a 390-pixel layout without horizontal overflow. See [task controls](task-controls.md) for exact release evidence and limits.

Production release: source `5b0d13bc0c69197bdaa8e9dbb1ed3c84598c1232` passed GitHub checks; deployment `dpl_5BHRGihsV1zWQsBE5NLNoA8yNvSc` is READY in `fra1` and aliased to the canonical URL. Authenticated browser inline rename, direct rich notes, bold save/close and pointer drag/drop passed on a disposable production list. A server reread verified exact Markdown and ordering, then the list was deleted and confirmed inaccessible. Development fixtures/grants were cleaned up. No real list content was used in screenshots.

## Private task images — October 16, 2026

Private Vercel Blob task-note images are implemented across web/API/MCP. `pnpm check` passed (22 unit tests, TypeScript, optimized build), and the final full development integration run passed all 16 tests. Browser checks verified upload/paste, draft cancellation, saving/reopening, descriptions, removal/cancel recovery, and a measured 390px layout. The SDK host displayed private images through MCP. Migration `0004_thick_harrier.sql` preserved existing production list/task/membership counts. See [task images](task-images.md#verification) for exact evidence, release status, cleanup behaviour and remaining host/device verification limits.

Production image release: commit `5a0a8c0` passed GitHub run `38902320494`; CLI deployment `dpl_5VtBVszyXyxaQG9HZyMXmsyGpZf8` is READY in `fra1` with the canonical alias. The signed-in production browser uploaded, saved and reopened a disposable private image note. A separate server read verified the Markdown/metadata and direct Blob HTTP 403. Unauthenticated API/MCP/cleanup checks returned 401; authenticated cleanup returned 200. The disposable list/image was removed and verified. Named-host image upload and second-human production sharing are not certified by these checks.

## Calendar due dates — October 16, 2026

See [due dates](due-dates.md) for current date validation/time-zone tests, domain and authenticated API/MCP coverage, browser draft/conflict checks, migration and release evidence. Historical test totals above belong to their respective milestones.

Release source `e314a19` passed GitHub run `38924450343`; CLI deployment `dpl_8sdh3YNCBkSHRZcEiQfwg74Pmoh5` is READY in `fra1` with the canonical alias. Authenticated production browser Today/Tomorrow/custom-date saves and badges passed. A server reread verified exact independent parent/child dates, ordering and completion; the disposable list was removed and confirmed inaccessible. The development suite passed 18/19 initially; the unchanged existing image-stream case passed in isolation, yielding 19 distinct passing cases across the two runs. Named-client production MCP verification was not repeated for this milestone.

## Mobile website layout — October 16, 2026

Fresh October 17 review: see [mobile usability check](mobile-usability-check.md) for local responsive browser evidence, saved screenshots, usability findings and cleanup. It does not replace the dated production release evidence below or certify physical phones.

See [mobile website layout](mobile-web-ui.md) for responsive decisions, 320/390px editor measurements, desktop checks, browser saves and independent persistence verification. This website-only milestone does not change API/MCP/domain contracts or the native/offline decision.

Source `450eea8` passed GitHub run `38948658330`; CLI deployment `dpl_9Y9KSsAdm6Q5QkzENWs3oTya5EAE` is READY in `fra1` and has the canonical alias. Production browser subtask rename, bold notes, reopening and combined phone editing passed at 390px without document overflow. A server reread verified exact persisted text and preserved dates/completion. Disposable production/development lists were removed and confirmed inaccessible. Twenty-five unit tests, TypeScript, optimized builds and the browser-bundle secret scan passed; no backend integration rerun or physical-device certification is claimed.

The subsequent single-line revision supersedes that task layout: phone rows use one actions button and inline rename icon controls; subtasks start collapsed, with retained child drafts reopening safely. See [single-line verification](mobile-web-ui.md#single-line-revision) for current proof and release status.

Single-line source `67086a6` passed GitHub run `38950652235`; deployment `dpl_Adox9ntu3qg4sLd22FV8xXJW5qkY` is READY in `fra1` with the canonical alias. Production browser row alignment, one-line rename save/reopen, rich notes and upward/clamped action placement passed. A server reread verified exact values and preserved dates/completion; disposable production/development lists were removed and confirmed inaccessible. The final local check passed all 25 unit tests, TypeScript and optimized builds; static browser scan passed. No backend integration rerun or physical-device certification is claimed.

Quiet icon controls source `404353f` passed GitHub run `38952060440`; deployment `dpl_BZ94rys69Gom6hKk1V5xXX2jJhzo` is READY in `fra1` with the canonical alias. Production rename/notes saves and server rereads passed, with transparent 44px controls and no document overflow at 390px. Development checks additionally exercised task/subtask/section creates, custom date save/clear, settings/sharing entry points and a 320px layout. Local check passed 25 unit tests, TypeScript and optimized builds; final build and static browser scan passed. Fixtures were removed and verified; physical-device and screen-reader checks remain separate. See [quiet controls](mobile-web-ui.md#quiet-icon-controls).

## Personal views — October 17, 2026

See [personal views](personal-views.md) for the independent preference revision, shared projection and exact verification limits. Development migration, TypeScript, 34 unit tests and optimized builds passed. The isolated final integration run passed all 21 tests, including HTTP/MCP view parity and live preference invalidation, after an earlier browser-overlapping run hit upstream auth throttling. Synthetic browser checks verified saved filters, detailed layout, MCP App grouping/collapse and website live delivery, with measured 320/390px layouts. Production migration preserved hashes of every existing list/task/membership row (2/15/1). Deployment and final production smoke evidence are recorded in the feature document.

Production source `0d15dcc` is verified on READY Frankfurt deployment `dpl_7asfc7hFYEZraSPFaj1TyNLuod5B`. Authenticated browser preference saves/reload/collapse and corrected 320/390px detailed rows passed. A server reread verified independent view/list revisions and projection; the disposable list/preference was removed and production returned to 2 lists, 15 tasks and 1 membership. See the [release evidence](personal-views.md#production-release) for source, screenshot and client/device limits.

## GitHub synchronization and design release smoke — October 17, 2026

[GitHub synchronization](github-sync.md) records the ownership, audience, token, webhook, worker and conflict contracts, exact installed-App evidence and cleanup. The final release passed `pnpm check` (39 unit tests, workspace/root TypeScript, optimized web/MCP builds). All 22 isolated-development integration tests passed; final focused OAuth/MCP checks additionally verified the new tools and denied old grants without `github:manage`. Real installed-App create/edit/close/reopen, conflict choices, disconnect/rebind and authorized PR context passed in the approved private sandbox. Signed production issue events returned 200 and updated the open Wuff task; real installation suspension and explicit reconnection passed. Removal/uninstall cases were provider-mocked rather than live uninstall proof.

Migration `0009_rainy_red_wolf.sql` was applied to existing development then production direct connections; before/after hashes preserved existing list/task/membership rows (2/19/1), with no auth-managed writes. A scan of 25 optimized browser/MCP files found no selected server secret values or GitHub domain SQL markers. The actual local SDK host exercised issue linking, conflict resolution, refreshed task content, synced state and PR context. A named production AI host and physical devices remain separate checks.

Production design smoke saved all seven palettes (restored Slate), Detailed/Compact preferences across reload (restored Compact), and rendered italic notes. Disposable development lists were independently confirmed missing; synthetic development GitHub credentials were removed. Production issue links were removed and the sandbox binding stopped; issues and the PR were closed, and the synthetic branch deleted. Existing user tasks and list membership were retained. Current release metadata follows after final deployment inspection.

Final application source `1f28701e85e2c7e8f8112e60fbb0f3803b9de625` passed [GitHub CI 39020915713](https://github.com/timbenniks/wuff-todo/actions/runs/39020915713). Vercel CLI deployment `dpl_7AoBawFodmsyXe46LALSxRU2Aoxh` is Ready, holds `https://wuff-todo.vercel.app`, and inspection confirms function region `fra1`. The final `pnpm check` passed. Production sign-in/discovery returned 200; anonymous list/GitHub API/MCP calls and an unsigned webhook returned 401. Subsequent documentation-only commits do not change the verified application bundle.

## Cursor agents and PR tracking — October 20, 2026

The first local implementation passed `pnpm check` (55 unit tests, TypeScript, optimized web/MCP builds), focused agent/GitHub development integration suites with mocked providers, and authenticated OAuth/HTTP/MCP scope checks. Synthetic Chrome checks against the production build covered the ticket/setup UI and measured 320/390/1280px ticket layout. Development migrations only; no paid run or production deployment. See [Cursor agents](cursor-agents.md#release-gates-and-verification) for evidence, earlier failures, and remaining live-provider/worker/account setup gates.

## Local development runtime recovery — October 20, 2026

Fresh Chrome reproduced the Turbopack missing process module factory error. Moving the 390 MB generated output aside and switching to Webpack did not restore hydration: React createContext/forwardRef failures persisted. The bundler change was reverted. `pnpm build` passed and a local `next start` restored interactive Lists (settings opened) and Cursor setup (encryption configuration recognized). Added `pnpm preview:local` for reproducible local integration testing with `.env.local`; no deployment or application-data mutation. Development-mode root cause remains unresolved.

Cursor server-credential follow-up: read-only `/v1/me` returned HTTP 200. TypeScript and optimized build passed; the isolated provider-mocked lifecycle test additionally proved deployment-key owner isolation and denial after mismatched owner configuration. Browser Connections recognized the configured account and showed no API-key input. No paid run was launched.

Personal Cursor connection consolidation: all accounts now use encrypted Neon records, including Tim; the global key fallback was removed. The focused lifecycle suite passed with separate personal connection status and ciphertext checks. Existing production user/list/task/member fingerprints were preserved through additive migrations 0011/0012 (counts 2/5/20/1). Credential ciphertext was read back and decrypted successfully before removing plaintext local/Vercel API-key configuration. No paid agent was launched or application deployed.

Production release source `026037b` is Ready on Vercel deployment `dpl_DNcK6bWwmrN5yxA8Xd52evgMas68`, aliased to the canonical URL with runtime `fra1`. Final local checks passed 55 unit and 25 development integration tests, TypeScript, optimized builds and both native bundle scans. Signed-in Connections showed the empty personal Cursor-key form with no captured browser errors; anonymous APIs and unsigned webhooks were rejected. Tim will enter his own key. Paid execution remains explicitly disabled. See [Cursor release](cursor-agents.md#production-release--october-20-2026) for exact evidence and outstanding worker/provider gates.

## Personal reminders and Settings — October 22

See [reminder verification](reminders.md#verification--october-22) for local UI, development migration, permission/concurrency/lifecycle tests, provider-mocked transports and remaining real-delivery gates. No production release or signed native delivery is claimed.

## Hosted design and prototype guide — October 23

[Guide architecture and evidence](prototype-guide.md) records the public static pages,
actual component inventory and source-kit fidelity, skill validation, isolated
standalone build and 320/390/1280px browser checks. No application-data or permission
change is introduced. ChatGPT Work cloud execution and physical-device/screen-reader
validation remain separate from these local checks.

## Desktop workspace — October 24, 2026

See [layout decisions and browser harness](desktop-workspace.md). Home uses a fluid 1/2/3-column grid, desktop lists fill the canvas beside fixed-width navigation, and task/settings pages use wider layouts. The shared Tauri frontend receives the same styles.

Local TypeScript, optimized web/MCP/prototype build and native frontend build passed. `scripts/verify-desktop-workspace.ts` exercises the actual optimized website with development-only synthetic fixtures: 320/390/768/1024/1280/1440/1920px canvas/card/overflow measurements, 1440×500 independent main/navigation scrolling and pinned account footer, 800px drawer, unsaved draft retention on phone resize, and task/settings columns. It also retains Home navigation/customization/reload/reset/all-hidden/history/startup, exact retry, conflict draft recovery, failed-read recovery and account-isolation checks. Fixture data and synthetic personal preferences are restored afterward. Hidden status announcements are positioned within the scroll canvas so they cannot extend document scrolling below it. Production release evidence follows after deployment; these checks do not prove installed native behavior or screen-reader use.

Source `077013a` was committed/pushed to main. GitHub Verify run `40030934697` and Native test builds run `40030934474` failed before any steps: check annotation says recent account payments failed or the spending limit needs increasing. Local checks above passed; remote CI and newly published native artifacts are not claimed.

Vercel CLI production deployment `dpl_HzxLuEUaeiKiS1VRNNse8YjdRJzT` is Ready, aliased to `https://wuff-todo.vercel.app`, with `fra1` outputs. Authenticated production Chrome at 1710px measured three visible Home tracks (~443px each), a 1450px main canvas beginning at x=260, a 1378px list heading, and no horizontal document overflow. Task pages measured 1440px with Notes/context tracks ~827/517px; Settings measured 1440px, both without overflow. Live updates connected, existing list/task data rendered, and no captured console errors occurred. These production checks only navigated/read; no production fixture, content or preference mutation was needed. [Production Home screenshot](screenshots/desktop-production.png). The browser harness was rerun successfully after ensuring the drawer screenshot waits for loaded task controls.

## Sidebar spacing — October 24, 2026

[Sidebar layout decisions](desktop-workspace.md#sidebar-spacing-refinement--october-24) separate Favorites from the full list tree and align Home, shortcuts, list icons and utility controls. Workspace/root TypeScript, optimized web/MCP/prototype build and shared native frontend build passed. The optimized development browser harness passed at 320/390/768/1024/1280/1440/1920px, now also asserting Home/favorite/list icon x-coordinate alignment, 44px row minimums and Favorites-before-list-heading order. Existing independent scrolling, pinned footer, drawer draft retention and Home behavior checks passed; synthetic fixtures/preferences were restored. Screenshots `desktop-home-*` show the updated sidebar. Production release evidence follows after deployment.

Source `e788113` was committed/pushed. A follow-up harness pass additionally opened/collapsed the navigation at both 320px and 390px, measured 44px list targets and no horizontal document overflow, and captured `sidebar-mobile-{320,390}.png`. GitHub Verify `40031660523` and Native test builds `40031660661` remain blocked before running any steps; the check annotation confirms the account payment/spending limit condition. Local checks above passed; no new downloadable native artifact is claimed.

CLI deployment `dpl_CzgUU3NiiUZWdsmoeM2N3fEgm84g` is Ready and aliased to the canonical production URL, with `fra1` runtime outputs. Authenticated production Chrome confirmed Home → Favorites → list-pack DOM order and existing shared list cues. Home, favorite and list icons all measured x=28; list rows measured 44px; the account footer ended at y=874 within the 894px viewport; no horizontal document overflow or captured console errors occurred. This was navigation/read-only verification, with no production content or preference writes. [Released sidebar](screenshots/sidebar-production.png).

## Single-entry favorite navigation — October 24, 2026

The user superseded the duplicate-shortcut design: active starred lists now appear only under Favorites, with one active navigation entry. The shared sidebar projection omits them from the regular tree; unstarred children of a starred parent remain reachable at the tree's top level without changing saved nesting/collapse/order or shared content. Unstarring restores the saved tree placement. Archive still lists archived favorites. The embedded MCP catalog uses the same projection and retains the full action menu on each favorite entry.

All 90 unit tests passed, including favorite-child exclusion, starred-parent child reachability, unchanged saved parent references, unstar restoration and archived favorites. Workspace/root TypeScript, optimized web/MCP/prototype and native frontend builds passed. The isolated-development website harness passed favorite add/reload, a single active sidebar entry, absent duplicate in the tree, starred-parent/unstarred-child reachability, nesting preservation, original owner draft/retry/archive/restore/editor cases and 320/390/1280px layouts. Fixture data and synthetic sidebar preferences were restored. Production and embedded SDK-host evidence follows after completion.

A real local MCP Apps SDK host passed single favorite entry counting, stale Add-to-favorites intent, reload, navigation with the parent collapsed, opening a favorite, removal through its retained action menu and 390/1280px layouts without page errors. The harness waited for the parent-collapse save to finish before issuing Remove; these are distinct mutations. Screenshots `list-favorites-mcp-*` show the deduplicated catalog. This is local SDK-host evidence, not named production ChatGPT/Codex-host certification.

Source `d6d4849` was committed/pushed and CLI deployment `dpl_DXjqkSXkHnKoT9QpwgGuG2dBEhWf` is Ready on the canonical production URL with `fra1` runtime outputs. Authenticated production Chrome counted one Wish-list entry in Favorites, zero in the regular tree and exactly one `aria-current="page"` entry after opening it. No horizontal overflow or captured browser errors occurred. No production content or server preference mutation was required. [Production single-entry sidebar](screenshots/favorites-single-entry-production.png). GitHub Verify `40032483573` and Native test builds `40032483482` were blocked before steps ran by the confirmed account payment/spending limit; local checks and Vercel build passed, and installed native/new downloadable artifacts remain separate.

## List workspace, Work columns and named presets — October 24, 2026

[Current design and persistence contract](list-workspace.md) replaces Your view with a compact toolbar on both Basic and Work lists. Wide Work lists default to optional metadata columns; Basic lists retain simple rows. Display controls density/columns/simple rows, and personal named presets can be created, updated, selected, renamed and explicitly deleted. The existing personal-view JSON and independent revision are extended; no SQL migration or managed-auth change is needed.

- All 91 unit tests passed, including preset name/ID/reference/bounds validation, unique columns/nested settings, legacy omission semantics and Work-only starter choices.
- Workspace/root TypeScript, optimized web/MCP/prototype build and shared native frontend build passed. Native frontend output retains its existing bundle-size advisory; this does not publish or verify installed clients.
- Both isolated-development view integration cases passed. They cover permission/admission/revocation, member isolation, unchanged tasks/shared revisions/order, stale versions, first-write concurrency, idempotent retries and operation reuse. New cases cover named preset isolation, legacy writes preserving all four extensions, concurrent edits sharing one revision, explicit deletion and unchanged task data.
- The actual optimized website harness covers 320/390/1024/1280/1440/1920px Work/basic layouts and bounded popovers; local preview versus explicit save; preset create/rename/select/delete and reload; member isolation; metadata cell status/priority/assignee/due saves, conflicts and retained drafts; restored cell drafts after filtering; display persistence; notes retained across density/phone resize; saved-view conflicts and lost-response exact retries. Fixtures are deleted afterward. The final pass also measured the sticky toolbar/header at 1440×500, verified successful saves/Cancel closing the cell editor, and changed a status that removed its row from the active filter without browser errors.
- A real local MCP Apps SDK host passed compact popovers, starter/custom preset creation/selection/rename/deletion, persisted column choices, 390/1280px document/popover bounds and lost-response retries with identical operation/payload. Synthetic lists and the SDK OAuth grant were cleaned up; prior synthetic sidebar preferences were restored. This is local SDK-host evidence, not named production ChatGPT/Codex-host certification.

Production release evidence follows after deployment. No installed native, physical-device or screen-reader certification is implied by browser/build checks.

Source `269244b` was committed/pushed. Vercel CLI deployment `dpl_9aba3Dqf82k14RX9f8qec74D371z` is Ready and aliased to the canonical production URL, with `fra1` runtime outputs. Authenticated production Chrome at 1710px verified the Work toolbar, five starter choices, preset-save entrypoint, Columns/Simple rows, density and four visibility controls. The Work grid measured 44/636/130/100/140/140/88/44px tracks; the old details panel was absent and no horizontal overflow occurred. Basic Pawvisions rendered zero Work headers and only section/date/completion filters, with a viewport-bounded popover. Live updates connected and no captured console errors occurred. The production smoke only navigated/read/opened controls: no task/content/server preference writes or production fixtures were required. Screenshots: [Work](screenshots/workspace-production-work.png), [Basic](screenshots/workspace-production-basic.png).

GitHub Verify `40036292290` and Native test builds `40036292242` failed before any steps started; the check annotation confirms the account payment/spending limit. Local checks and Vercel build passed; new downloadable native packages and installed-device behavior remain separate. MCP clients need a catalog refresh for the expanded view schema.

## Task-first phone lists — October 24, 2026

[Design and scope](mobile-task-first.md) replace the large list card with a compact sticky title/settings bar and move phone view controls into a modal panel. Healthy/initial live-status copy no longer occupies task space; subscriptions remain mounted and reconnection/read failures still surface. Owner rename is part of the existing versioned settings save; sharing and confirmed deletion are reachable inside settings. The shared website/Tauri frontend receives the layout.

Final workspace/root TypeScript, optimized web/MCP/prototype build and native frontend build passed. The web build retains the existing docs CSS `@source` warning and the native frontend retains its bundle-size advisory. No dependency, schema or environment change was needed.

The updated `scripts/verify-list-workspace-ui.ts` passed against the optimized isolated-development website:

- Work/Basic layouts at 320/390/1024/1280/1440/1920px as applicable, bounded popovers and no document overflow. Responsive geometry checks wait for the phone controls to mount; CSS also hides desktop-only controls during the initial narrow server render.
- At 390×844 the first task starts at **y=227px**, about 27% down the viewport. An additional 390×640 scrolling check pins the title bar at y=0. At 1440×500 the title, view toolbar and Work column headings remain stacked without overlap.
- Phone settings open sharing and return to settings; a long list name saves without overflow, then restores. Cancelling the explicit permanent-delete confirmation preserves the list. Editor settings expose People/personal preferences and omit owner name/delete/archive controls.
- Phone search preview, unsaved indicator, save/reload, draft clearing and dialog focus restoration pass. An aborted response after a committed phone view save displays in-panel recovery; retry sends the identical body and operation ID and completes successfully.
- Existing preset create/rename/select/delete, account isolation, metadata saves/conflict drafts, display preferences, notes retained across phone resizing, saved-view conflicts and desktop exact-request retries all pass. No captured page errors occurred. Disposable lists were deleted in cleanup.

Screenshots were visually reviewed: [phone list](screenshots/mobile-task-first-390.png), [View panel](screenshots/mobile-task-first-view-390.png), [settings](screenshots/mobile-task-first-settings-390.png). Additional responsive/sticky images are in ignored `.vercel/mobile-task-first/`.

Production release verification is pending; no production deployment or production mutation was performed during these checks. Browser tests and frontend builds do not certify physical phones, installed native packages or screen-reader use.

## UX improvement Phase 1 — October 24, 2026

The [six-phase specification](ux-improvement-spec.md) turns the complete local
screenshot audit into sequential acceptance gates. Phase 1 is implemented in the
shared web/Tauri UI: a stable desktop Add task action and phone bottom action,
a title-first capture dialog with explicit list/section destination, two-line
phone titles, active-filter chips and Clear filters, distinct empty/no-match
messages and acknowledged creation feedback. Clearing filters previews personal
changes and preserves sorting/grouping/display and saved-view definitions until
an explicit save. Task-title navigation already existed and remains unchanged.

Checks against the optimized localhost website and the existing isolated
Vercel-managed Neon development branch:

- `pnpm typecheck` passed workspace and root TypeScript, including the new harness.
- `pnpm test` passed all 91 unit tests.
- `pnpm build` passed optimized web/MCP/prototype builds. The existing docs CSS
  `@source` warning remains. The generated component catalog includes TaskCapture.
- `pnpm build:native:web` passed; the existing bundle-size advisory remains.
- `node --env-file=.env.local --import tsx scripts/verify-list-workspace-ui.ts`
  passed responsive Basic/Work layouts, bounded popovers, settings/role controls,
  saved-view preview/save/reload/presets, metadata edits, conflict/draft retention,
  personal isolation and exact-request retry checks. The first phone task remains
  at y=227px at 390×844. This pass caught duplicate filter controls outside an open
  phone View dialog; the implementation now hides the outside controls while
  that dialog is open, and the suite passed afterward.
- `node --env-file=.env.local --import tsx scripts/verify-ux-phase-one.ts` passed
  against the final optimized build. A disposable 100-task Work list verifies
  capture reachability at 320/390/1440px without end scrolling, a minimum 44px
  capture target, no horizontal document overflow, two-line phone titles, initial
  title focus, Escape/Cancel focus return and retained drafts. A rejected 409
  preserves input; aborting a response after server commit then retrying sends an
  identical operation/payload and leaves exactly one new task in the chosen
  section. Active search/zero-match recovery, creation-under-filter feedback,
  unsaved-versus-saved view state, preserved sort/group/density/columns, editor
  capture and archived-list capture restrictions pass. No captured browser page
  errors occurred. The synthetic lists/membership/view records were deleted in
  `finally`; no production data or preferences were changed.

Visual review: [capture](screenshots/ux-phase-one-capture-390.png),
[filter recovery](screenshots/ux-phase-one-filters-390.png),
[two-line list](screenshots/ux-phase-one-list-390.png). The workspace harness also
refreshes the earlier mobile-task-first screenshots to show the current controls.

A first long-list run overlapped a local rebuild and failed before the responsive
controls hydrated. Tests were rerun against a freshly started, stable optimized
server; the final Phase 1 run passed. That failed run's fixture was also cleaned
up. This is local browser/build evidence, not production release, physical-phone
keyboard, screen-reader, installed native or named embedded MCP-host validation.
No migration, dependency/environment change, deployment or paid execution was
needed. Phase 2 (mobile navigation/View surfaces/task detail hierarchy) is next.

## UX improvement Phase 2 — October 24, 2026

The [phase specification and decisions](ux-improvement-spec.md#phase-2--mobile-navigation-view-and-task-details)
are implemented locally in the shared web/Tauri UI. Phones use a labeled Lists
trigger and dedicated modal navigation with wrapping list names, current selection
and an independently scrolling list area. Create list replaces that surface with
one title/type form; Simple remains the default. Its draft survives Back/closing,
its pending operation retains the selected mode on exact retries, and an
acknowledged create opens task capture for the new list. Desktop keeps the sidebar
and uses the same short create form in a dialog.

Phone Filter/Sort/Group/Display/Presets are named regions replacing the contents of
the same View dialog, with Back to view, Done and explicit Save view. Display omits
columns that are only rendered on desktop. Existing view conflicts, drafts and
retry feedback remain inside the modal. Desktop popovers remain available.

Phone Work rows show status and assignee. The shared task detail source places Work
details before Notes; Change status sits alongside completion and opens the
existing scoped Work form. Wide task pages keep Notes on the left and Work details,
Subtasks and integrations on the right. Explicit grid rows keep long notes from
pushing the right-hand Subtasks section down. Open notes are not saved by Work
edits, and the existing dirty-close confirmation remains in force.

Native modal/inert behavior is supplemented by shared first/last Tab wrapping in
Lists, View, task details and capture. This resolves the browser check that found
Shift+Tab could otherwise move focus outside the dialog. The helper ignores
already-handled keys and hidden/disabled controls; normal interior tab order and
editor-specific behavior stay intact.

Final local checks:

- `pnpm typecheck`: workspace and root TypeScript passed, including the new harness.
- `pnpm test`: all 91 unit tests passed.
- `pnpm build`: optimized web/MCP/prototype build passed; the existing docs CSS
  `@source` warning remains. The source kit/catalog includes the new form/helper.
- `pnpm build:native:web`: passed, retaining the existing bundle-size advisory.
- `node --env-file=.env.local --import tsx scripts/verify-ux-phase-two.ts`: passed
  against the final optimized localhost build. At 320/390px, navigation wraps full
  names, marks one current selection, returns focus and leaves the main canvas in
  place. A 390×320 viewport forces independent navigation scrolling and verifies
  the same scroll position after reopening, plus first/last keyboard wrapping.
  Create checks name focus, Simple default, retained name/type drafts, a committed
  then aborted response, identical retry bodies/operation IDs, exactly one Work
  list and focused task-capture handoff. Every phone View page remains in one
  active modal with zero floating popovers; Back restores its trigger, Done closes
  the sheet, focus wraps and unsaved filters survive reopening. Work checks status
  and assignment summaries, Work-before-Notes hierarchy, status input focus,
  In progress → In review save without completion, independent note drafts through
  Work editing/resize, dirty-close confirmation and return to the originating
  task. Long notes/references, wide standalone columns/Subtasks placement,
  completion → Done, and Basic omission of Work controls pass. No captured browser
  page errors occurred.
- `node --env-file=.env.local --import tsx scripts/verify-list-workspace-ui.ts`:
  passed after updating its phone assertions from nested popovers to in-sheet
  regions/Back. Existing Basic/Work responsive geometry, metadata saves, preset
  lifecycle, personal isolation, draft/conflict recovery and exact lost-response
  view retries still pass. The first phone task remains at y=227px at 390×844.

One preliminary workspace run encountered a temporary development session-check
failure during priority saving and correctly retained its draft; a subsequent
stable run passed. Earlier targeted runs corrected fixture/locator assumptions
and exposed the keyboard boundary issue above. No auth configuration was changed.
The browser suites use only the existing isolated development branch, delete their
synthetic lists/membership/view fixtures in `finally`, and do not alter production
content or preferences. No migration, dependency/environment change, deployment,
external integration connection or paid run was needed.

Visually reviewed screenshots: [navigation at 320px](screenshots/ux-phase-two-navigation-320.png),
[navigation at 390px](screenshots/ux-phase-two-navigation-390.png),
[create list](screenshots/ux-phase-two-create-390.png),
[View subpage](screenshots/ux-phase-two-view-390.png),
[phone task details](screenshots/ux-phase-two-details-390.png), and
[desktop task details](screenshots/ux-phase-two-details-desktop.png).

Phase 2 is **locally complete; production release is pending**. These browser
checks do not certify physical-phone keyboards, screen readers, installed native
packages or named embedded MCP hosts. The existing API/MCP domain contracts and
permissions are unchanged. Phase 3 is actionable Home and completion flow.

## UX improvement Phase 3 — October 24, 2026

Home now provides a compact Your day header, separate completion/title controls,
explicit destination capture and the existing task drawer without leaving Home.
Recovery uses session-only Recently completed/Reopen instead of a timed Undo.
The all-completion list view folds previously completed roots into Completed;
newly completed rows stay in place during the current visit. Parents with open
children remain visible. No view preference, schema, permission or API/MCP tool
contract was changed. See [decisions](ux-improvement-spec.md#phase-3--actionable-home-and-completion-flow).

Final local checks:

- `pnpm typecheck`: workspace/root TypeScript passed.
- `pnpm test`: all 91 unit tests passed.
- `pnpm build`: optimized web/MCP/prototype build passed; existing docs CSS
  `@source` warning remains.
- `pnpm build:native:web`: passed with the existing bundle-size advisory.
- `node --env-file=.env.local --import tsx scripts/verify-ux-phase-three.ts`:
  passed against the optimized localhost application. At 320/390/1440px, Home
  has no horizontal overflow, reachable capture and completion targets at least
  44px. Task titles independently open/close details on Home with focus return.
  Completion moves Work to Done; Reopen restores an active task. Aborting the
  response after a committed completion and creation then retrying sent identical
  bodies/operation IDs, created one task and only offered recovery after ack.
  A known conflict retained the task without a false completed entry. Destination
  load failure/retry and list/section switches retained the title; the final task
  reached the chosen Basic list with no stale Work section. Undated creation
  explained Today exclusion; Open list retained its saved filter/empty-state
  recovery. Completed starts collapsed without preference writes, keeps parents
  with open children visible, and reopens into the original section with focus.
  Explicit completed-only views remain explicit. Focus refresh showed a remote
  domain title update. Revoked membership removed the destination while retaining
  the capture title and disabling submission. Other-account preferences stayed
  unchanged; no captured page errors occurred.
- `node --env-file=.env.local --import tsx scripts/verify-desktop-workspace.ts`:
  passed Home customization/reload/reset/all-hidden, last-list/explicit-Home and
  history navigation, personal isolation, exact preference retries, conflict draft
  recovery and failed reads, plus desktop canvas/navigation/drawer geometry and
  phone reflow. The harness now waits for responsive navigation to mount after
  resizing and uses the new Home title/link/drawer semantics.

- `node --env-file=.env.local --import tsx scripts/verify-list-workspace-ui.ts`:
  passed Basic/Work responsive controls/columns, preset lifecycle, metadata saves,
  personal isolation, note/conflict drafts, saved views and exact retries. The
  390×844 first-task position remains y=227px.

Early runs corrected a Work fixture using an unsupported create field and a
responsive test that measured navigation before React had mounted it. Visual
review also found an unrelated completion error inside fresh capture; feedback
is now scoped to capture's own failure or unresolved retry.

Browser fixtures use only the existing isolated development branch. Lists,
memberships and synthetic views are deleted in finally; original personal Home
preferences/sidebar settings are restored. No deployment, migration, external
connection or paid action was needed. These are optimized local browser checks,
not production, installed-native, physical-keyboard, screen-reader or named MCP
host certification. Remote update evidence uses focus/fallback refresh and does
not certify a named client event stream.

Visually reviewed [phone Home](screenshots/ux-phase-three-home-390.png),
[narrow Home](screenshots/ux-phase-three-home-320.png),
[desktop Home](screenshots/ux-phase-three-home-1440.png),
[capture](screenshots/ux-phase-three-capture-390.png) and
[Reopen recovery](screenshots/ux-phase-three-reopen-390.png), and
[expanded Completed group](screenshots/ux-phase-three-completed-390.png).

Phase 3 is **locally complete; production release pending**. Phase 4 is shared
management and recovery.

## UX improvement Phase 4 — October 24, 2026

List settings now uses one dialog with List details, People, Only for me and
Manage list pages. A direct People button opens that same dialog. Owner/editor
and Private/Shared cues are literal. Page switches and closing/reopening retain
unsaved owner details; loading latest is explicit. People separates access from
pending in-app invitations and explains that no email is sent. Removal/leave and
permanent deletion explain their consequences and require confirmation. Archive
is separate from deletion; archived owners have direct Restore on the list while
editors receive owner guidance. Wuff unavailable/error pages offer safe list/retry
exits and invalid OAuth requests instruct restarting from the originating app.
No sharing, ownership, version or API/MCP contract changed.

Local verification uses `scripts/verify-ux-phase-four.ts` against the optimized
website and the isolated development branch: one active settings modal, direct
People, literal roles, retained details through page switches and invitations,
committed/lost invitation response with identical retry payload/operation ID and
one pending invitation, recipient acceptance, editor restrictions, cancelled
leave/delete, member removal and denied access, archive/direct restore with tasks
preserved, safe unavailable-task and invalid-OAuth exits. Screenshots cover Basic
People/archive at 320/390/1280px. A first pass exposed 320px invitation-field
min-content overflow; a bounded grid and wrapping content corrected it.

`pnpm typecheck`, `pnpm test` (91 passing), optimized web/MCP/prototype `pnpm build`, and
`pnpm build:native:web` passed (existing docs CSS and native size advisories).
`node --env-file=.env.local --import tsx --test --test-concurrency=1
 tests/domain.integration.test.ts tests/list-features.integration.test.ts` passed
all nine existing real development integration cases. These additionally prove
private/shared permissions, owner management, revocation, admission, exact
retries, concurrency, ordering, invitation expiry/decline/cancel/accept races,
archive boundaries, sections and personal order isolation.

Disposable list/task/invitation/membership fixtures are deleted in finally. No
production data, schema, provider connection or paid action was changed. Local
browser/contract proof does not certify physical devices or screen readers.
Production release remains pending.

## UX improvement Phase 5 — October 24, 2026

Reminder settings now lead with scheduling, delivery-service configuration,
registered devices and this browser’s permission before schedule preferences.
Delivery is explicitly unverified here; registering a device no longer claims
successful delivery. Unavailable delivery uses Save preference. Quiet hours show
the timezone and when the daily time moves. Task/list preferences use the same
exact-request recovery hook: uncertain writes lock their draft and provide Retry
same request; known failures retain editable drafts and explicit reload controls.

GitHub setup stages personal account → Work list/repository → sharing consent →
optional automatic issues. Destination/export scope is visible before saving;
changing list/repository resets consent, and Stop synchronization appears only
for an active binding. Reads have selection epochs; mutations are pinned to the
rendered account and uncertain writes preserve their exact request.

Cursor setup separates personal account, repository, environment, required
secrets and paid execution. `cursorConnection` adds the read-only
`executionEnabled` boolean from the existing operator gate; no execution behavior
changes. The same domain result serves HTTP/MCP. Failed readiness reads have a
retry; stale list reads cannot replace a later selection. Environment creation
explicitly names its paid allowance. Saving setup does not start a run.

Local checks: workspace/root `pnpm typecheck`, all 91 unit tests, optimized
web/MCP/prototype build and native frontend build passed. Existing docs CSS and
native size advisories remain. The real isolated-development reminder and Cursor
integration suites passed both cases with provider fetches mocked and QStash
delivery disabled. They cover isolation, version conflicts, retry receipts,
reminder lifecycle/deduplication and agent ownership, secrets, reconciliation and
execution gating. A final Cursor rerun also asserts the new execution flag.

`scripts/verify-ux-phase-five.ts` passed on the optimized localhost website with
all reminder/GitHub/Cursor provider requests intercepted. It checks unavailable
and configured reminder/device status, explicit unverified delivery, quiet-hours
adjustment, identical uncertain preference retries with locked retained drafts,
320/390/1280px overflow; failed GitHub read/retry, disconnected account staging,
repository consent/optional automation, identical bind retries and list-switch
reset; failed/ready Cursor reads and disabled paid execution. No agent POST,
notification permission prompt, device registration, GitHub publication or real
provider mutation occurred. Original real reminder settings matched afterward;
disposable lists were deleted. No captured page errors occurred.

Visually reviewed [reminders at 320px](screenshots/ux-phase-five-reminders-320.png),
[GitHub setup](screenshots/ux-phase-five-github-390.png) and
[Cursor readiness](screenshots/ux-phase-five-cursor-390.png). This is local
browser/provider-mock evidence. Actual notification delivery, installed native
clients, external GitHub/Cursor setup and paid runs remain separate checks.
Phase 5 is locally complete; production release pending.

## UX improvement Phase 6 — October 24, 2026

Saved views is now the user-facing name for personal display presets. Save view
updates the current view; Save as new view opens an explicit naming flow. The
serialized preset contract and existing saved settings remain compatible.

Shared web/native due-date surfaces now reuse TaskDueDate, including Work table cells. Today,
Tomorrow and Clear date stage a draft; Save date commits it and Cancel discards.
Empty saved drafts clear the date. Dirty drafts retain their expected list
revision. Remote changes keep the draft and require explicit Load latest date;
acknowledged/retried values reconcile without silently overriding other edits.

Invited-account setup/recovery now separates Send code, Resend code and Change
email. Code input supports one-time-code autofill and normalizes pasted spaces;
password fields retain new-password semantics. Mismatch, expired/failed codes,
connection errors and rate limits have clear feedback. Failed attempts retain the
current form; changing email clears code/password drafts. Resend cooldowns use an
absolute deadline so background timer throttling does not extend the wait. Login
keeps username/current-password semantics and distinguishes rate limiting from
credential/network failures. No managed-auth endpoint, admission rule or session
behavior changed.

The public guide uses compact phone page selection, palette controls on Design
language only, early kit/copy/template actions, component name/path search and
jump links, plus visible source-base and exact-build-hash provenance. The build
exports a feature brief template alongside the existing kit/skill. Prototypes
still use synthetic content and never grant access to private lists.

Workspace/root TypeScript, all 91 unit tests, optimized web/MCP/prototype and
native frontend builds passed. Existing docs CSS/native size advisories remain.
The isolated-development due-date domain integration case passed permissions,
versioning, exact retries, independent child dates and task lifecycle behavior.
The updated `scripts/verify-list-workspace-ui.ts` passed responsive Basic/Work,
Saved views create/rename/select/delete, personal isolation, metadata/date saves,
note/conflict drafts and exact retry recovery. First phone task remains y=227px.

`scripts/verify-ux-phase-six.ts` passed against the optimized local website:
mocked code requests/resends/rate limits, invalid/expired reset responses,
password mismatch without a request, retained inputs and success; normalized
six-digit code entry/autocomplete attributes; sign-in rate-limit feedback and
real synthetic-account website sign-in. Auth code/reset responses are mocked;
no live mailbox or real account credential was changed. A deferred duplicate
code-focus request was removed after it could interrupt entry under accelerated
timers. Passwords use native form values so browser and password-manager input
is retained through feedback and resends.

The same browser harness verifies early resources, copied starter text using an
in-memory clipboard stub, successful kit/skill/template/manifest/agent-reference
requests, compact navigation, design-only palette controls, component search,
empty search results, jump links and 320/390/1280px overflow. Real disposable Work
tasks prove table/drawer shortcut drafts, Save date, staged Clear date, cancellation,
remote revision/draft retention, explicit latest-date reload, and a committed then
lost date response with identical retry body/operation ID. Recovery clears stale
local error feedback after confirmation. Fixtures are deleted in finally and no
captured page errors occurred.

A final Phase 5 browser rerun also proves that refreshing delivery status retains
a dirty schedule’s original expected version. A simulated remote change still
conflicts; the draft remains until the explicit Load latest preferences action.
Readiness refresh cannot silently rebase a schedule edit. Exact retry adopts a new
preference revision only when the retried action was that schedule save.

Phase 6 is locally complete. Screenshots include
[auth feedback](screenshots/ux-phase-six-auth-390.png),
[early guide resources](screenshots/ux-phase-six-guide-start-390.png),
[component search](screenshots/ux-phase-six-guide-320.png) and
[date recovery](screenshots/ux-phase-six-date-390.png).
Production release, physical keyboard/autofill, screen readers, installed native
clients, named MCP hosts, full browser zoom/text-scaling review and participant
usability comparisons remain explicitly unverified. No provider activation or
paid work was used to demonstrate the UI.

Embedded MCP follows the same Saved views vocabulary and staged date shortcuts,
Clear/Save/Cancel, original expected revision, explicit latest-date load and exact
retry behavior. `scripts/verify-ux-phase-six-mcp.ts` uses the real local MCP Apps
SDK host and authenticated server: it checks the labels, no mutation before Save,
a committed date response lost at the host bridge and identical tool arguments/operation ID on retry (SDK progress metadata changes normally),
actual saved/cleared dates, Cancel, and a bounded phone iframe. The fixture owns
and deletes its list and revokes its OAuth grant on exit. This is local SDK-host
proof, not certification of a named production ChatGPT/Codex client.

Final SDK-host run exited successfully after fixture cleanup. Its SDK adds a new
progress token for each call; the test compares the unchanged domain arguments
and operation ID rather than unrelated transport metadata. Reviewed screenshots:
[SDK host phone](screenshots/ux-phase-six-mcp-390.png) and
[SDK host desktop](screenshots/ux-phase-six-mcp-1280.png).

## Wishlist app workspace — October 24, 2026

[WUFF-120–123 specification](app-workspace-shell.md): logo/wordmark Home link,
aligned desktop title rail, and account Settings plus embedded Docs using the
existing ListApp sidebar and mobile dialog. WUFF-80 was explicitly deferred; no
reminder form, provider, scheduler, domain/API or MCP contract implementation changed.

- Workspace/root TypeScript and all 91 unit tests passed. Optimized `pnpm build`
  (prototype kit, MCP and web) and `pnpm build:native:web` passed. Existing docs
  `@source` and native chunk-size advisories remain. This proves the native frontend
  compiles; no native installer/device run was performed.
- `node --env-file=.env.local --import tsx scripts/verify-app-workspace-shell.ts`
  passed against the final optimized build. At 1280/1920px the list title and brand
  center differ by at most 2px, the main starts at x260 and scrolling content leaves
  the sidebar pinned. Keyboard and mouse logo activation select explicit Home;
  browser Back restores the list. Settings/Docs active destinations, guide page
  navigation/palette/reload, 320/390px document overflow and mobile Escape/focus
  return passed. Screenshots: `docs/screenshots/app-shell-{list,docs,navigation}-*.png`.
- Anonymous public guide, agent reference and prototype archive returned successfully;
  anonymous `/settings/docs` redirected to sign-in. Public HTML contained no private
  fixture IDs and authenticated settings omitted another synthetic account's private
  list. Existing authorization services load the account sidebar.
- A Settings list creation was committed, then its response was deliberately aborted.
  Closing the dialog retained an available recovery action. Retrying sent the exact
  same body/operation ID, produced exactly one list and opened its real list URL;
  no pending ID entered browser history. Existing fixture tasks matched exactly.
  Disposable lists were deleted by the harness; no production app data was used.
- Existing `verify-list-workspace-ui.ts` passed Work/Basic layouts, toolbar and saved
  views, metadata/conflict drafts, preferences, exact retries and phone layouts.
  `verify-ux-phase-six.ts` passed public guide/auth recovery and date-editor regression
  coverage on rerun. Its first run timed out awaiting the date editor's background
  refresh; no date implementation was changed, and the rerun passed conflict recovery
  and committed-response-loss retry. This intermittent wait remains a harness caveat.
- Browser page errors were absent in the new app-shell harness. Initial harness-only
  selector mistakes were corrected to match the existing guide labels before the
  passing runs. The mobile logo selector was updated for its new link wrapper,
  retaining the original 40px illustration and compact header geometry.

Local implementation is ready for review and source push to main. Production
runtime, installed native clients, physical touch, assistive technologies and
participant usability remain separate verification. Existing public `/docs` URLs
and downloads are preserved; authenticated embedded guide routes are `/settings/docs`.

## Totake and shared notification controls — October 25, 2026

Implementation source: `61347699ec162c1db82d87748ad104ed1b7d23f1` on
`codex/wuff-totake`, draft PR #26. Contract and explicit release gates:
[Totake](totake.md). No application production deployment or actual notification
send is claimed. Existing unrelated root dependency/tooling edits were retained
locally and excluded from the PR.

- `pnpm typecheck`: all workspace and root scripts/tests passed.
- `pnpm test`: **156 tests, no skips**. `tests/totake.test.ts` covers empty personal
  defaults; identities/no backfill; stock/Undo/Skip/Snooze; strict selection;
  liquid/drop exclusion; exact twelve-decimal count arithmetic; Add versus Correct;
  PRN registration/intake/Undo; immutable history; DST gap/fold and elapsed-hour
  repeated labels; weekdays/day intervals/cycles; weekly sensor anchors; one-only
  scoped moves and active repeat cadence; timezone edits without fabricated sends;
  global/app pause/privacy projection; future-snooze rejection; and delayed-read
  version/account guards and explicit-recovery priority over periodic reads; due reminders retained after a definition becomes as-needed. Updated `tests/native-features.test.ts` exercises native
  action/query/account pinning and rejection; `tests/empire-settings.test.ts`
  verifies new consent roots/default preservation and opt-in summary behavior.
- `pnpm build`: guide generation, MCP bundle and optimized web build passed.
- `pnpm build:native:web`: frontend compilation passed. Existing >500kB chunk
  advisory remains; this is not an installed Totake or push-registration test.
- The serial integration command for `tests/totake.integration.test.ts`,
  `tests/reminders.integration.test.ts`, `tests/empire-settings.integration.test.ts`
  and `tests/empire-adapters.integration.test.ts` passed **five tests, no skips**.
  The focused Totake pair was rerun after final domain changes and passed again.
  Tests use the actual optimized HTTP/MCP/native adapters and real isolated
  transactions: consent/PKCE, dedicated/readonly/legacy grants, refresh expansion
  denial, account/origin guards, API-write/MCP-read and MCP-write/readback,
  native Undo, bounded summary without medicine names, conflicts/concurrency,
  same-operation replay, revocation including receipt replay, notification
  settings parity, paused/stale callbacks, per-device partial failure receipts,
  current-state cancellation and recovery of an overdue scheduled job.
  Push senders are mocked; loopback prevents publication to QStash.
- `node --env-file=.env.local --import tsx scripts/verify-totake.ts`: optimized
  browser and real local MCP Apps SDK host exercise selected recording, exact
  Undo/stock, lost committed response and identical explicit retry, Cancel,
  dirty cross-category dismissal, conflict/draft/load-latest, failed-refresh
  read-only recovery, future-snooze availability, opt-in portal summary,
  shared pause Save/Cancel/readback, and 320/390/1280px document overflow.
  The SDK fixture additionally loses a committed tool reply and retries identical
  arguments. Synthetic data and grants are cleaned; existing personal settings
  are restored. This is local SDK-host proof, not named ChatGPT/Codex production
  host, touch device or screen-reader proof.
- Screenshots `docs/screenshots/totake-*` show overview, inventory, reminder,
  six-stage review, Empire summary and actual embedded MCP controls with fictional
  data. No private handover reference images/conversation/medication data were
  added to the repository.

Migration `0019_totake_and_notifications.sql` was explicitly authorized for
**development and production**. Development applied first. Production preflight
required a distinct direct connection, all nineteen prior migration hashes and
only 0019 pending. Ten new tables and final migration hash were read back; all
existing user/list/task/member row counts and complete row fingerprints matched
before/after. Only app tables and Drizzle bookkeeping changed; no auth-managed
schema or production medicine fixtures were written.

Read-only `vercel env ls production` name inventory was verified against the
existing DATABASE_URL entry. It showed no complete Web Push/native push provider
configuration and no Totake delivery flag. No credential values were displayed,
no provider was provisioned/configured and no real message was sent. Actual
native push registration/actions, native Totake workspace/optional consent flow,
provider setup and closed/restarted-phone plus Galaxy Watch 7/Garmin Venu 3 proof
remain release work. Current native workspace stays Todo. Large-history pagination
and performance beyond the initial personal aggregate are documented limits.

GitHub Verify run 40188248561 and policy run 40188246816 did not start: account
billing/spending limits blocked runners. These are incomplete remote checks,
not passing code verification. Keep the PR draft. Vercel preview status and final
PR metadata are recorded separately; preview backend isolation is unconfirmed,
so no preview writes or medical-data smoke are claimed.

## Todo navigation maturity — October 31, 2026

Implemented on draft [PR #45](https://github.com/timbenniks/wuff-todo/pull/45).
Application source `9acccc9f8820ab84bf270217d089eee350a8e9a5`; later delivery
commits record evidence and tighten browser synchronization/capture only.
[Behavior, scope and review record](todo-ux-maturity-plan.md).

- `pnpm typecheck` passed all workspace packages, web and root scripts/tests.
- `pnpm test` passed **195 unit tests**, zero failures/skips. Changed tests:
  `tests/list-nesting.test.ts` retains canonical favorite hierarchy and archive
  fallback; `tests/todo-navigation.test.ts` covers list-search/context, current
  access/archive filtering, finite width/viewport bounds, malformed/blocked
  storage, account isolation/reset and current authorized MCP response catalogs,
  including missing read scope and post-mutation read failure. A controlled
  rollback of the original favorites projection failed the two relevant
  hierarchy regressions; restoring the implementation passed.
- `pnpm preview:local` passed guide generation, MCP packaging and optimized Next
  build, then served the local app on port 3000. No Vercel deployment was run.
- `node --env-file=.env.local --import tsx --test --test-concurrency=1
tests/todo-navigation.integration.test.ts tests/list-nesting.integration.test.ts
tests/list-favorites.integration.test.ts` passed **all 4 integration tests**.
  Actual adapters prove HTTP-write/MCP-read and MCP-write/HTTP-read, personal
  hierarchy/favorites isolation, unchanged task snapshots, stale/concurrent writes,
  exact-payload retries, read-only denial, private-list exclusion, sharing and
  membership revocation, catalogs in reads and mutation replies, and revoked
  connection rejection. Fixtures use the documented isolated development branch
  and synthetic accounts; created data/connections are cleaned up.
- `node --env-file=.env.local --import tsx scripts/verify-todo-navigation.ts`
  passed the optimized web app and **actual local MCP Apps SDK host**, with no
  page errors. Web checks include 320/390/1024/1280/1366/1440px document overflow,
  phone Lists/Escape, root alignment, undated/nonfavorite discovery, search and
  no-match recovery, restored expansion, hidden day panels with lists retained,
  pointer/keyboard width persistence/reset and window bounds, direct personal move
  out/back, parent/child/sibling navigation and Back. A committed favorite save
  with a lost reply retries the identical payload. Catalog failure has an explicit
  retry; a detail-only 503 preserves successful catalog/context. Embedded checks
  cover list-first Home/search, canonical/favorite navigation and retained parent/
  child/sibling context after actual task mutations.
- First Codex review found two recovery defects; `9acccc9` fixed both with
  regressions and evidence replies. Fresh review of that application source
  completed with no findings. Latest delivery-head review/check status is kept in
  the PR. Review completion is separate from test results.

Browser connector startup failed because its service module was missing; the
repository's headless Chrome/Playwright harness supplied rendered browser proof.
Phone viewport checks do not establish physical touch/device behavior, screen
reader compatibility, browser zoom or a named ChatGPT host. Human usability review
and production release remain separate. No schema, scope/consent, provider or
production configuration change. Unrelated package/workspace/lockfile edits remain
outside feature commits.

Final adapter rerun after the catalog recovery fix: four domain cases passed; the
HTTP nesting write returned managed-auth 429 and navigation consent SSR returned
500 with `auth_unavailable`/429 in the local server log. Those two cases remain
blocked for current-source full-adapter verification. The earlier all-six pass and
updated real SDK recovery pass remain separate evidence. Keep PR #45 draft.
