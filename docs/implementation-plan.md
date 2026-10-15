# Wuff Todo implementation plan

Status: web, existing-account sharing, MCP, and branding deployed; live list updates next

Updated: October 15, 2026

The web/API/MCP foundation and existing-account sharing are implemented and deployed. The phases below preserve the delivery sequence; this current-status section and the next-build scope take precedence over historical phase wording. See [verification](verification.md) for evidence and [development](development.md) for the selected auth design. Operator provisioning, email-code password setup, and existing-account sharing are implemented. Tim reported successful activation and Codex usage; automated authenticated Codex validation is recorded in [MCP validation](mcp-validation.md). Joreel’s independent activation/client verification, native auth validation, and personal sidebar ordering remain outstanding. This sequence is a delivery guide, not a claim that every exit criterion is complete.

## Current status and handoff

- **Implemented:** invite-only admission and password activation/recovery; private lists; shared editor membership; owner-only list/sharing management; task CRUD, completion/reopening, and shared task ordering; safe retries and stale-version conflicts.
- **Sharing:** existing admitted accounts receive in-app invitations with seven-day expiry. Owners cancel invitations or remove members; editors can leave. Invitations send no email. See [sharing](sharing.md).
- **Clients:** the website and authenticated MCP endpoint are deployed at `https://wuff-todo.vercel.app` and `/api/mcp`. The MCP catalog has 18 tools. The embedded MCP App manages lists/tasks; sharing controls are on the website and available as structured MCP tools.
- **Branding:** Waffles is integrated into web identity, favicon/manifest/share assets, and the MCP App. Native icon source assets exist; native apps do not. See [mascot details](waffles-mascot.md).
- **Freshness today:** open web views poll every ten seconds and refresh on focus. Live subscriptions are not implemented.
- **Verification:** 9 unit tests and 9 development integration tests passed for sharing; production Codex tool checks passed. Tim reported working activation, Codex use, and sharing. Joreel's independent activation/client connection, ChatGPT end-to-end, and named-host interactive MCP UI remain unverified. See [verification](verification.md) and [MCP validation](mcp-validation.md).
- **Later scope:** personal sidebar ordering, archive/restore, new-account invitation delivery, native apps/auth, offline editing, themes, and richer task scheduling/details. Custom SMTP remains an operational follow-up.

Before resuming, inspect `git status`, read the operating instructions in [development](development.md), and check the actual code and available tools. The ignored local environment and synthetic fixture files are machine-local; a fresh clone needs setup. Provision Neon through Vercel, preserve the isolated development branch, and verify `fra1` on actual deployments. Do not recreate accounts/resources or rerun migrations merely because this is a new chat. Past verification is dated evidence; rerun checks relevant to the change before making new claims.

## Next build: live list updates

Confirmed October 15, 2026. Planned, not implemented. Keep the current ten-second polling and refresh-on-focus behavior for now.

The next milestone is live updates for open lists, covering both collaboration and changes made through AI clients:

- When two people have a shared list open, additions, edits, completion/reopening, deletion, and task ordering changes appear in the other person's view without a manual reload.
- When a user has a list open on the website and changes that same list through ChatGPT using Wuff's MCP connection, the open website updates too. This applies to the user's private lists as well as shared lists; it does not require a second user.
- Updates follow committed database changes regardless of whether they came from the website or MCP. Existing API/domain mutation permissions, version checks, and idempotency remain authoritative.
- Live subscriptions respect account admission, ownership, and current membership. Revoking access must also remove the list from an open view and stop further live data delivery.
- Recover after disconnects and refresh authoritative state on reconnect. Keep the existing polling/focus refresh as a fallback, and preserve in-progress user input when remote changes arrive.

Evaluate Neon Realtime against the existing Vercel-managed database when this milestone starts. Realtime support and the subscription design need implementation-time validation; no infrastructure or application behavior changes are part of recording this plan.

Acceptance scenarios: two synthetic users edit one shared list and see each other's changes; one user edits an open private list through an authorized MCP client and sees the website update; membership revocation and reconnects reconcile correctly. Include a ChatGPT end-to-end check when its Wuff connection is available, and distinguish that result from Codex-only validation.

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

Decide offline behavior, secure session storage, synchronization, distribution, and release workflows before implementation. Widgets, notifications, and share extensions require separate scope decisions.

## Phase 5: list personalization

Add themes, custom colors, and images after the basic workflow is proven. Decide whether a list's appearance is shared or personal, who can change it, and how images are stored and served. Maintain readable contrast and accessible controls for every theme.

## Decisions and remaining work

| Area                          | Current decision/status                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sign-in and account admission | Managed Neon email/password, operator provisioning, enabled Wuff profile required; public signup closed               |
| Existing-account sharing      | Implemented in-app invitations, seven-day expiry, owner cancellation/revocation, editor leaving; no invitation emails |
| New-account invitations       | Future scope; operator provisioning remains the only account-admission path                                           |
| MCP authorization             | Implemented separate OAuth layer preserving Neon identity; read, task-write, and list-manage scopes                   |
| Client verification           | Codex tools validated; ChatGPT and other named hosts, inline UI, and Joreel's independent connection remain to verify |
| Ordering                      | Shared task order implemented; personal sidebar order deferred                                                        |
| Concurrent mutations          | List versions, transactional permission checks, and actor-scoped operation receipts implemented                       |
| Cross-client freshness        | Polling/focus refresh implemented; live updates are the next build described above                                    |
| Archive and deletion          | Owner-only permanent deletion implemented; archive/restore deferred                                                   |
| Corgi branding                | Waffles integrated; see mascot asset and verification documentation                                                   |
| Native and offline support    | Future Expo/mobile design and verification work                                                                       |

## Verification strategy

Focus automated tests on permission isolation, invitation lifecycle, ordering, concurrency, and idempotency. Test the same core operations through API and MCP adapters. Use browser checks for the two-user workflow, keyboard controls, responsive layouts, and recoverable failures.

Auth and MCP claims require live integration evidence. A successful build alone does not prove login, authorization, sharing, or production behavior. Record commands and outcomes when implementation begins.
