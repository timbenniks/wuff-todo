# Wuff Todo implementation plan

Status: web, sharing, MCP, live updates, and mature lists implemented

Updated: October 16, 2026

The web/API/MCP foundation and existing-account sharing are implemented and deployed. The phases below preserve the delivery sequence; this current-status section and the next-build scope take precedence over historical phase wording. See [verification](verification.md) for evidence and [development](development.md) for the selected auth design. Operator provisioning, email-code password setup, and existing-account sharing are implemented. Tim reported successful activation and Codex usage; automated authenticated Codex validation is recorded in [MCP validation](mcp-validation.md). Joreel’s independent activation/client verification and native auth validation remain outstanding. This sequence is a delivery guide, not a claim that every exit criterion is complete.

## Current status and handoff

- **Implemented:** personal sidebar order, shared owner-controlled list colors/descriptions, sections, archive/restore; invite-only admission and password activation/recovery; private lists; shared editor membership; owner-only list/sharing management; task CRUD, completion/reopening, and shared task ordering; safe retries and stale-version conflicts.
- **Sharing:** existing admitted accounts receive in-app invitations with seven-day expiry. Owners cancel invitations or remove members; editors can leave. Invitations send no email. See [sharing](sharing.md).
- **Clients:** the website and authenticated MCP endpoint are deployed at `https://wuff-todo.vercel.app` and `/api/mcp`. The MCP catalog has 27 tools, including private image upload/read. The embedded MCP App manages lists/tasks; sharing controls are on the website and available as structured MCP tools.
- **Branding:** Waffles is integrated into web identity, favicon/manifest/share assets, and the MCP App. Native icon source assets exist; native apps do not. See [mascot details](waffles-mascot.md).
- **Freshness today:** Neon Realtime streams accessible list/version changes to open web views. Changes trigger authorized API reads; ten-second polling and focus/visibility refresh remain as fallback. See [live updates](live-updates.md).
- **Web/offline decision:** keep the website online as it is, with its existing manifest/icons. No offline-first PWA or offline mutation queue. Revisit offline needs during React Native/Expo mobile planning; native offline support is not assumed.
- **Verification:** 12 unit tests, 10 development integration tests, TypeScript checks, and a production build passed for live updates; production Codex tool checks for the earlier sharing milestone passed. Tim reported working activation, Codex use, and sharing. Joreel's independent activation/client connection, ChatGPT end-to-end, and named-host interactive MCP UI remain unverified. See [verification](verification.md) and [MCP validation](mcp-validation.md).
- **Task notes:** formatted text and canonical Markdown are implemented for web/API/MCP, with an on-demand Tiptap toolbar, safe shared renderer and MCP App source editor. Website task actions now open editing directly, hide Markdown implementation details and use drag handles for tasks, sections and the sidebar; see [task controls](task-controls.md). Corgi wordplay covers app guidance and feedback. Release verification is recorded in [task content and voice](task-content.md).
- **Later scope:** due times/reminders, new-account invitation delivery, native apps/auth, offline editing, and broader themes. Custom SMTP remains an operational follow-up.
- **Subtasks:** one level beneath a task, with inline names, independent completion, shared ordering and parent progress across web/API/MCP. Children follow their parent’s section; parent deletion cascades. See [subtasks](subtasks.md) for contracts and release evidence.
- **Due dates:** optional calendar dates on tasks and subtasks, Today/Tomorrow/custom date/clear controls, due-today/overdue badges and MCP support. Manual order and independent parent/child state are preserved. See [due dates](due-dates.md).
- **Mobile website:** compact list navigation, single-line phone task rows and rename fields, direct Delete/drag controls and a secondary-actions disclosure, and a compact scrolling rich-text toolbar. Routine controls use quiet neutral icons with accessible names/tooltips. Visible form fields now share shadcn-based Input/InputGroup components, one focus treatment and 44px grouped icon controls. Desktop task controls remain direct. See [mobile website layout](mobile-web-ui.md). Native/offline plans are unchanged.
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

The list-focused [mature lists milestone](mature-lists.md) is implemented: personal sidebar order, shared owner-controlled colors, plain-text list descriptions, sections, and owner archive/restore. Formatted task notes and Markdown are now implemented in [task content and voice](task-content.md); the user chose formatted text first. Private images are implemented in [private task images](task-images.md), with release verification recorded there. One-level subtasks are implemented in [subtasks](subtasks.md). Calendar due dates are implemented in [due dates](due-dates.md). Next: plan React Native/Expo mobile and validate native auth; decide offline needs before building queued edits. Cover images, arbitrary custom colors, notifications, and recurrence have not been selected. Preserve the online website/offline boundary.

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

Add an Expo application targeting iPhone and Android. Reuse contracts, the API client, design tokens, and assets. Build native components with the same visual identity.

Before mobile implementation, revisit the PWA/offline deliberation confirmed October 15, 2026. The user has mixed experiences with PWAs and offline-first systems; compare online-only use, cached reads, and queued offline edits against real mobile use cases instead of defaulting to offline-first. Decide secure local storage/session handling, conflict and retry behavior, revoked access, account cleanup, synchronization, distribution, and release workflows. See [the architecture boundary](architecture.md#web-and-mobile-offline-boundary).

This is future React Native/Expo design work. Preserve current website behavior; live updates for connected web views and changes made through ChatGPT/MCP are implemented. Widgets, notifications, and share extensions require separate scope decisions.

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
| Native and offline support    | Revisit online-only, cached reads, and offline edits during React Native/Expo planning; website stays online          |

## Verification strategy

Focus automated tests on permission isolation, invitation lifecycle, ordering, concurrency, and idempotency. Test the same core operations through API and MCP adapters. Use browser checks for the two-user workflow, keyboard controls, responsive layouts, and recoverable failures.

Auth and MCP claims require live integration evidence. A successful build alone does not prove login, authorization, sharing, or production behavior. Record commands and outcomes when implementation begins.
