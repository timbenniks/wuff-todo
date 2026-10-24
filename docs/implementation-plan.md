# Wuff Todo implementation plan

Status: web/MCP and GitHub synchronization released; online-only Tauri cross-platform client foundation started

Updated: October 24, 2026

The web/API/MCP foundation and existing-account sharing are implemented and deployed. The phases below preserve the delivery sequence; this current-status section and the next-build scope take precedence over historical phase wording. See [verification](verification.md) for evidence and [development](development.md) for the selected auth design. Operator provisioning, email-code password setup, and existing-account sharing are implemented. Tim reported successful activation and Codex usage; automated authenticated Codex validation is recorded in [MCP validation](mcp-validation.md). Joreel’s independent website sharing actions were reported and their saved results confirmed on October 18; her own MCP client and installed native auth validation remain outstanding. This sequence is a delivery guide, not a claim that every exit criterion is complete.

## Current status and handoff

- **UX improvement programme (October 24):** the complete audit is translated into
  [a six-phase specification](ux-improvement-spec.md). Phase 1 is locally complete:
  stable task capture, readable phone titles and visible filter recovery. Production
  release is pending; [local evidence](verification.md#ux-improvement-phase-1--october-24-2026)
  records browser recovery checks and builds. Phase 2 is also locally complete:
  a labeled mobile Lists sheet, focused list creation, View subpages within one
  modal, Work summaries/details before notes, and keyboard focus wrapping. See
  [Phase 2 evidence](verification.md#ux-improvement-phase-2--october-24-2026).
  **Phase 3 (actionable Home) is next**, followed by shared management/recovery,
  readiness and consistency. This authorised UX work runs alongside the native milestone.

- **Task-first phone lists (October 24):** compact sticky title/settings bar, on-demand list management and a phone View panel are implemented locally. See [design and verification scope](mobile-task-first.md); production release remains pending.

- **List workspace (October 24):** compact toolbar and personal named presets for both list types, richer optional Work columns and inline metadata editing are released on the website/MCP. Local unit/integration/browser/SDK checks, web/native frontend builds and authenticated production Work/Basic layout checks passed. Native downloads remain blocked by runner billing. See [contract and release evidence](list-workspace.md).

- **Desktop workspace (October 24):** fluid Home card rows, wider list/task/settings canvas and independently scrolling desktop navigation are released. Local 320–1920px browser checks and authenticated production geometry checks passed. See [layout decisions and verification](desktop-workspace.md).

- **Personal Home (WUFF-87, October 23):** configurable welcome/Today/Coming up/Favorites is released on the website/MCP and marked done after authenticated production overview/layout/reload/startup/reset checks and fixture cleanup passed. Shared Tauri frontend and local domain/adapters/browser/SDK checks passed; native downloads remain blocked by GitHub runner billing limits. See [feature contract](home-dashboard.md).

- **Personal list favorites (WUFF-86, October 23):** released on the website/MCP and marked done after authenticated production save/reload/shortcut/remove and live Codex reads passed. Active favorites now appear once in navigation, with unstarred children kept reachable and saved nesting preserved (October 24). Personal shortcuts preserve existing nesting and shared content; migration 0016 and disposable smoke preserved pre-existing data. Native frontend checks passed, while downloadable artifacts remain blocked by GitHub runner billing limits. See [favorites contract](personal-list-favorites.md).

- **Personal list nesting (WUFF-85, October 23):** one-level account-specific sidebar hierarchy is implemented across shared web/Tauri features and MCP and released on the website/MCP. Authenticated production save/reload/collapse and live Codex reads passed; WUFF-85 is done. Native artifact publication remains blocked by GitHub runner billing limits. Parent and child lists retain independent tasks/subtasks and sharing. See [contract, migration and release boundaries](personal-list-nesting.md).

- **Contributor prototyping (October 23):** hosted `/docs` guide, real component examples, generated source kit, agent-readable reference and portable skill support a non-coder using ChatGPT Work without a local checkout. See [design guide and verification](prototype-guide.md). Actual use in her Work workspace remains a separate check.

- **Personal reminders and Settings (October 22):** selected scheduled jobs rather than minute polling, personal account/list/task UX, and all server delivery adapters together. The core implementation is built locally alongside Tauri, with development-only migrations and provider-mocked verification. See [reminder plan and release gates](reminders.md); provider setup and installed native delivery remain explicit gates.

- **PR tracking and Cursor agents (October 20):** the user resumed Stage 4 and authorized implementation, including environment secrets, ticket conversations and MCP parity. Personal connections and PR tracking are deployed; release evidence and execution gates are recorded in [Cursor agents](cursor-agents.md). Native push delivery is now selected in the personal reminder milestone; installed registration and provider setup remain gates. No production agent execution is enabled.

- **Pre-mobile hardening (October 18):** visible issue/sync summaries, optional native GitHub consent and phone notes/progress cues are implemented; real Joreel sharing/revocation and Tim recovery were reported and checked within the documented boundaries. Native notes and private images are required for the first mobile release. See [checkpoint and release evidence](pre-mobile-checkpoint.md).

- **GitHub follow-up (October 18):** opt-in automatic linked-issue creation for future top-level Work tasks is implemented; the user selected the existing test repository for Tim’s work and automatic creation is enabled there. The existing two-way title/notes/completion contract also applies. Production migration preserved existing rows. Worker contention and pooled advisory-lock handling were hardened; release evidence is recorded in the feature document. See [automatic issue creation](github-sync.md#automatic-issue-creation--october-18-2026).

- **Implemented:** personal sidebar order, shared owner-controlled list colors/descriptions, sections, archive/restore; invite-only admission and password activation/recovery; private lists; shared editor membership; owner-only list/sharing management; task CRUD, completion/reopening, and shared task ordering; safe retries and stale-version conflicts.
- **Sharing:** existing admitted accounts receive in-app invitations with seven-day expiry. Owners cancel invitations or remove members; editors can leave. Invitations send no email. See [sharing](sharing.md).
- **Clients:** the website and authenticated MCP endpoint are deployed at `https://wuff-todo.vercel.app` and `/api/mcp`. The MCP catalog has 41 tools, including private image upload/read. The embedded MCP App manages lists/tasks; sharing controls are on the website and available as structured MCP tools.
- **Branding:** Waffles is integrated into web identity, favicon/manifest/share assets, and the MCP App. Native source assets are reused by the new local Expo app; installed-device validation is outstanding. See [mascot details](waffles-mascot.md).
- **Typography and controls:** DM Sans is selected and self-hosted across web/MCP with real italics; shared web selects have inset chevrons and Your view has centered disclosures and tighter spacing. [Typography](typography-review.md) records the decision.
- **Design language:** [shared controls, status tags and list-driven themes](design-language.md) unify web/MCP appearance. The selected list's named color drives app surfaces, text, controls and focus; semantic status/danger colors remain explicit. See that document for local checks and release limits.
- **Freshness today:** Neon Realtime streams accessible list/version changes to open web views. Changes trigger authorized API reads; ten-second polling and focus/visibility refresh remain as fallback. See [live updates](live-updates.md).
- **Web/offline decision:** keep the website online as it is, with its existing manifest/icons. No offline-first PWA or offline mutation queue. On October 17, the user also selected online-only React Native/Expo mobile for now; native offline editing is deferred.
- **Verification:** the GitHub release passed 39 unit tests, TypeScript, optimized web/MCP builds and all 22 isolated-development integration cases. Actual installed-App create/edit/close/reopen, signed production deliveries, suspension/reconnection and local MCP SDK controls passed. Production palette/view/italic-note smoke passed. Named ChatGPT/Codex interactive-host and physical-device checks remain separate. See [GitHub evidence](github-sync.md) and [verification](verification.md).
- **GitHub:** owner-authorized personal-account repository bindings, explicit issue link/create, two-way title/notes/open-state, durable jobs/webhooks, conflicts/retries and related PR context. The App is installed only on the approved private test repository; production test links were removed after verification. External clients need explicit `github:manage` consent.
- **Task notes:** formatted text and canonical Markdown are implemented for web/API/MCP, with an on-demand Tiptap toolbar, safe shared renderer and MCP App source editor. Website task actions now open editing directly, hide Markdown implementation details and use drag handles for tasks, sections and the sidebar; see [task controls](task-controls.md). Corgi wordplay covers app guidance and feedback. Release verification is recorded in [task content and voice](task-content.md).
- **Later scope:** shared due times, new-account invitation delivery, native distribution and remaining native feature UI, offline editing, arbitrary theme colors and dark mode. Custom SMTP remains an operational follow-up.
- **Subtasks:** one level beneath a task, with inline names, independent completion, shared ordering and parent progress across web/API/MCP. Children follow their parent’s section; parent deletion cascades. See [subtasks](subtasks.md) for contracts and release evidence.
- **Due dates:** optional calendar dates on tasks and subtasks, Today/Tomorrow/custom date/clear controls, due-today/overdue badges and MCP support. Manual order and independent parent/child state are preserved. See [due dates](due-dates.md).
- **Mobile website:** compact list navigation, single-line phone task rows and rename fields, direct Delete/drag controls and a secondary-actions disclosure, and a compact scrolling rich-text toolbar. Utilities use quiet icons; primary actions have explicit filled buttons, and expanded actions have labels. Visible form fields now share shadcn-based Input/InputGroup components, one focus treatment and 44px grouped icon controls. Desktop task controls remain direct. See [mobile website layout](mobile-web-ui.md). Native/offline plans are unchanged.
- **Personal views:** per-account/list filters, grouping, sorting, layout and collapse state, with shared API/MCP projection and independent revisions. See [personal views](personal-views.md) for behavior and verification.
- **Voice:** the web and embedded MCP App use Waffles' corgi wordplay across app-authored guidance and feedback. Controls and permission rules stay explicit; user content and machine contracts stay unchanged. See [Waffles' voice](voice.md) for examples and release checks.

Before resuming, inspect `git status`, read the operating instructions in [development](development.md), and check the actual code and available tools. The ignored local environment and synthetic fixture files are machine-local; a fresh clone needs setup. Provision Neon through Vercel, preserve the isolated development branch, and verify `fra1` on actual deployments. Do not recreate accounts/resources or rerun migrations merely because this is a new chat. Past verification is dated evidence; rerun checks relevant to the change before making new claims.

## Live list updates — implemented October 16, 2026

Confirmed October 15 and implemented October 16, 2026. [Live-update design and verification](live-updates.md) record the current implementation. Polling and focus refresh remain active as fallback.

The implemented milestone covers both collaboration and changes made through AI clients:

- When two people have a shared list open, additions, edits, completion/reopening, deletion, and task ordering changes appear in the other person's view without a manual reload.
- When a user has a list open on the website and changes that same list through ChatGPT using Wuff's MCP connection, the open website updates too. This applies to the user's private lists as well as shared lists; it does not require a second user.
- Updates follow committed database changes regardless of whether they came from the website or MCP. Existing API/domain mutation permissions, version checks, and idempotency remain authoritative.
- Live subscriptions respect account admission, ownership, and current membership. Revoking access must also remove the list from an open view and stop further live data delivery.
- Recover after disconnects and refresh authoritative state on reconnect. Keep the existing polling/focus refresh as a fallback, and preserve in-progress user input when remote changes arrive.

Neon Realtime is enabled on the existing Vercel-managed project’s isolated development and production branches. No database project was replaced and no application schema migration was needed. Short-lived capabilities are sealed by the authenticated web backend; admission and membership remain live SQL dependencies.

Verified scenarios: synthetic shared-list changes arrive through the live transport; MCP additions/completion update an open shared and private web view; access revocation removes the open list; subscription renewal, dropped-connection recovery, and pending-input preservation work. Actual ChatGPT host usage remains a separate check; authenticated MCP protocol tests do not certify every client.

## Next milestone

**Current milestone: online-only Tauri 2 for macOS, Windows, iPhone and Android.** On October 22 the user requested a client-side React/shadcn application using the existing hosted APIs and live refresh, tracked through Wuff itself. See [Tauri client plan](tauri-client-plan.md) for phases and gates. WUFF-70 introduces the React/Vite workspace and Tauri shell; frontend checks pass. The sign-in foundation now compiles as a macOS app; [auth evidence](tauri-auth.md) records protocol tests and remaining installed-platform gates. WUFF-71/72 cover installed sign-in, secure storage, API access and a live subscription probe before full interface migration. The dedicated Wuff Todo Work list is bound to `timbenniks/wuff-todo`; [development and task map](tauri-client.md) record all ten tasks and evidence.

The October 17 React Native/Expo slice remains available as a reference for authentication and client behavior. Its historical implementation and verification limits are recorded in [native mobile](native-mobile.md). Preserve it until the Tauri replacement passes its gates; its earlier milestone wording below is historical and does not override the new client plan.

On October 20 the user explicitly resumed Stage 4 research and implementation. The first local PR tracking and Cursor agent handoff implementation is now built alongside the existing native milestone; see [Cursor agents](cursor-agents.md). Stage 3 [GitHub synchronization](github-sync.md) remains released within its documented limits. Paid production agent execution is not enabled.

### Completed design work and earlier milestones

**Design language and themes — October 17, 2026:** the [shared design language](design-language.md) implements the [audit](design-language-audit.md): explicit action/status hierarchy, coherent spacing/alignment, labeled forms/management and seven list-driven palettes across the selected web/MCP experience. Pointer position picking supplements dragging; task deletion is confirmed consistently. See the feature document for fresh verification and release limits. The earlier [static specimen](design-language-specimen.html) remains the design proposal.

**Work features before native — October 17, 2026:** the user selected mostly personal work with occasional collaboration, real GitHub App synchronization, and API/MCP parity for future developer tooling. The staged [work-task plan](work-tasks-plan.md) takes precedence over the earlier native-next sequence. Stage 1 work lists, metadata, keys and task pages, Stage 2 [personal views](personal-views.md), and Stage 3 [GitHub synchronization](github-sync.md) are released. Stage 4 authorized agent execution is deferred by user decision.

**Mobile website check — October 17, 2026:** a fresh synthetic local responsive review exercised capture, rename, subtasks, notes, calendar dates, completion/reopening and keyboard reordering. See [mobile usability check](mobile-usability-check.md) for measured 320/390px layouts, screenshots, prioritized findings and verification limits. The design release resolves childless-delete confirmation, list reload/Back context, labeled secondary actions and non-drag position picking. Narrow titles and quiet notes/progress cues remain usability follow-ups; perform physical iPhone/Android checks before detailed native planning. No native app or offline behavior was implemented by this review.

The list-focused [mature lists milestone](mature-lists.md) is implemented: personal sidebar order, shared owner-controlled colors, plain-text list descriptions, sections, and owner archive/restore. Formatted task notes and Markdown are now implemented in [task content and voice](task-content.md); the user chose formatted text first. Private images are implemented in [private task images](task-images.md), with release verification recorded there. One-level subtasks are implemented in [subtasks](subtasks.md). Calendar due dates are implemented in [due dates](due-dates.md). After the selected work-feature milestones, plan React Native/Expo mobile and validate native auth; decide offline needs before building queued edits. Cover images, arbitrary custom colors, notifications, and recurrence have not been selected. Preserve the online website/offline boundary.

**Image milestone — October 16, 2026:** implementation uses separate private Vercel Blob stores, Neon attachment records, authorized delivery, and Markdown references. Web upload/paste/drop and MCP image tools are implemented; release verification is recorded there. See [private task images](task-images.md) for the lifecycle and release evidence. Subtasks and calendar due dates are now implemented; mobile/offline behaviour is unchanged.

## Phase 0: resolve architectural risks

Decide the initial sign-in method, first-owner bootstrap, invitation policy, and target MCP clients. Prove invitation-gated Neon authentication and delegated MCP authorization in a minimal application before building the full interface.

Validate the future mobile sign-in approach without creating the mobile app. Confirm Vercel/Neon integration behavior, preview isolation, and MCP App rendering in the selected client.

Exit criteria: a signed-in user can call a protected operation through web and MCP; an unauthorized user cannot; an MCP App can render and invoke an authorized tool. Record the chosen auth design and remaining limitations.

## Phase 1: repository and backend foundation

- Initialize the repository and pnpm workspace; add only needed packages.
- Configure Next.js, TypeScript, Tailwind, and shadcn/ui.
- Define application schema, Drizzle migrations, and shared contracts.
- Implement private lists, basic tasks, permissions, ordering, and retry handling in domain services.
- Expose the versioned API and corresponding MCP tools.
- Establish synthetic seed data and preview deployment workflow using GitHub and Vercel CLIs.

Exit criteria: two test accounts have isolated private lists; API and MCP implement identical operations; meaningful permission and concurrency tests pass.

## Phase 2: useful web app and sharing

- Build the responsive list/task interface and Wuff visual identity.
- Add manual list and task ordering, completion, and reopening.
- Implemented: existing-account invitations, acceptance/decline, cancellation, membership revocation, and leaving a list; new-account onboarding invitations remain future work.
- Implement owner-only list management and the agreed archive/deletion behavior.
- Add loading, conflict, offline-error, and empty states.
- Choose and implement the cross-client refresh strategy.

Exit criteria: the shared grocery-list scenario in the product specification works with two accounts. Keyboard interaction and small-screen layouts are manually checked.

## Phase 3: MCP UI and first private release

- Build MCP Apps for list browsing and task management using shared web components.
- Validate the agreed client matrix and tool-only fallback.
- Verify duplicate retries, stale edits, revoked membership, and revoked client access.
- Configure production auth and invitations for the first two real users.
- Deploy through the agreed CLI workflow and run authenticated production smoke checks using disposable test data.

Exit criteria: all first-release acceptance criteria pass, supported clients are documented, and both initial users can use the deployed web app and MCP connection.

## Phase 4: native mobile

**In progress, selected October 17, 2026.** The user confirmed online-only for now. `apps/mobile` uses React Native/Expo, shared public contracts/client/design packages and existing Waffles assets. The initial local slice includes secure sign-in/session restoration, authorized list/task/sharing operations and active-app polling/foreground refresh. See [native scope, auth and delivery gates](native-mobile.md).

No persistent task/list cache, offline mutation queue, notifications, widgets or share extensions are included. Native authentication uses the existing admitted website identity via a system-browser PKCE flow with separate native token audience. Installed-device validation, advanced native feature UI and signing/distribution remain outstanding. Website behavior stays online and unchanged.

## Phase 5: broader list personalization

Named shared list colors were delivered before mobile in the mature-list milestone; owners control them. Cover images, arbitrary custom colors, and broader themes remain future work. Decide image ownership, storage, and access rules before adding uploads. Maintain readable contrast and accessible controls for every theme.

## Decisions and remaining work

| Area                          | Current decision/status                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sign-in and account admission | Managed Neon email/password, operator provisioning, enabled Wuff profile required; public signup closed               |
| Existing-account sharing      | Implemented in-app invitations, seven-day expiry, owner cancellation/revocation, editor leaving; no invitation emails |
| New-account invitations       | Future scope; operator provisioning remains the only account-admission path                                           |
| MCP authorization             | Implemented separate OAuth layer preserving Neon identity; read, task-write, and list-manage scopes                   |
| Client verification           | Codex tools validated; ChatGPT and other named hosts, inline UI, and Joreel's independent connection remain to verify |
| Ordering                      | Shared task order and independent personal sidebar order implemented                                                  |
| Concurrent mutations          | List versions, transactional permission checks, and actor-scoped operation receipts implemented                       |
| Cross-client freshness        | Polling/focus refresh implemented; live updates are implemented with polling/focus fallback                           |
| Archive and deletion          | Owner-only permanent deletion and archive/restore implemented                                                         |
| Corgi branding                | Waffles integrated; see mascot asset and verification documentation                                                   |
| Native and offline support    | Online-only selected for Expo native apps; initial local slice implemented, installed-device proof pending            |

## Verification strategy

Focus automated tests on permission isolation, invitation lifecycle, ordering, concurrency, and idempotency. Test the same core operations through API and MCP adapters. Use browser checks for the two-user workflow, keyboard controls, responsive layouts, and recoverable failures.

Auth and MCP claims require live integration evidence. A successful build alone does not prove login, authorization, sharing, or production behavior. Record commands and outcomes when implementation begins.

## Tauri cross-platform client — October 22, 2026

Workspace PR #11, sign-in PR #12 and shared-controls PR #13 are merged. macOS/Windows CI passes for the auth/shared UI slice; packaged macOS warm/cold callbacks, restart and Keychain restoration are verified. See [auth](tauri-auth.md), [shared UI](shared-ui.md) and [live transport](tauri-live.md). Live transport PR #14 is also merged. Core workspace PR #15 is merged. Core editing, bounded cache, notes/private images and Work context now share browser-compatible features with Tauri; see [shared workspace evidence](tauri-features.md). Installed Windows/iOS/Android and signed distribution remain release gates.

## Native download releases — October 22, 2026

WUFF-82 adds a private GitHub prerelease after each main-branch push/merge and a manual main-branch run for grouped releases. All four platform builds and application checks must pass before the complete draft is published. See [native releases](native-releases.md) for source/version provenance, downloads, retry behavior and verification. Signed installers and physical-device acceptance remain WUFF-78/79 gates.
