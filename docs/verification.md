# Implementation verification

Date: October 15, 2026

## Implemented milestone

October 17 work-task foundation: [delivery plan and evidence](work-tasks-plan.md) records the selected pre-native sequence, shared web/API/MCP implementation, 29 unit tests, 20 live development integration tests and responsive browser/SDK-host checks. GitHub sync and agent execution remain planned.

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
