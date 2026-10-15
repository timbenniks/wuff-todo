# Wuff Todo implementation plan

Status: foundation implemented; remaining milestones below  
Updated: October 15, 2026

The first technical proof and part of Phase 1 are implemented. See [verification](verification.md) for evidence and [development](development.md) for the selected auth design. Initial-user onboarding, external named-host checks, native auth validation, sharing controls, and personal sidebar ordering remain outstanding. This sequence is a delivery guide, not a claim that every exit criterion is complete.

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
- Implement invitations, acceptance, membership revocation, and leaving a list.
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

## Open decisions

| Decision                              | Proposed starting point                                                     | Needed by |
| ------------------------------------- | --------------------------------------------------------------------------- | --------- |
| Initial sign-in methods               | Choose after checking current Neon capabilities                             | Phase 0   |
| Initial owner bootstrap               | Controlled provisioning; no public bootstrap route                          | Phase 0   |
| Who may invite new people             | List owners, subject to an explicit app invitation policy                   | Phase 0   |
| Invitation delivery and expiry        | Email-bound, expiring, revocable invitations                                | Phase 0   |
| MCP OAuth integration                 | Keep Neon identity; prove compatible delegated authorization                | Phase 0   |
| Supported MCP clients                 | At least one UI-capable host and a tool-only configuration; names to choose | Phase 0   |
| Sidebar/task ordering                 | Personal sidebar, shared task order                                         | Phase 1   |
| Conflict handling                     | Version checks and explicit conflict responses                              | Phase 1   |
| Archive and permanent deletion        | Owner-only; confirm permanent deletion                                      | Phase 2   |
| Cross-client freshness                | Select a measurable target and refresh mechanism                            | Phase 2   |
| Corgi artwork and final visual design | Shared assets with a calm task interface                                    | Phase 2   |
| Mobile offline support                | Separate mobile design decision                                             | Phase 4   |

## Verification strategy

Focus automated tests on permission isolation, invitation lifecycle, ordering, concurrency, and idempotency. Test the same core operations through API and MCP adapters. Use browser checks for the two-user workflow, keyboard controls, responsive layouts, and recoverable failures.

Auth and MCP claims require live integration evidence. A successful build alone does not prove login, authorization, sharing, or production behavior. Record commands and outcomes when implementation begins.
