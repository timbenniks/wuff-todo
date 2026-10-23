# Implementation verification

Updated: October 23, 2026. Older sections retain their milestone-specific evidence and test counts.

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
