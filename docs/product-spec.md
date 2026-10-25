# Wuff Todo product specification

Status: working specification, version 0.1

Updated: October 25, 2026

## Empire product modules

Todo and Totake are product-owned modules in the existing deployment. The
[modules guide](guide/modules.md) defines manifests, contracts, domain/schema/UI
ownership and typed web/MCP/notification composition. Account, consent, transport
and design primitives remain shared. Existing routes, tool IDs, data ownership,
reminder rules and native navigation are preserved. [Refactor evidence](empire-modules.md)
distinguishes local implementation from release. No database migration is needed.

## Purpose

Wuff Empire is the private portal for the family's apps. Its personal dashboard
and shared top navigation open Wuff Todo and Wuff Totake. Wuff Todo
helps friends and family manage private and shared lists; Wuff Totake adds personal medicine/equipment tracking and scheduled reminder rules;
actual installed notification delivery remains a separate release gate. Waffles the corgi and one invite-only account
connect the experience. See [portal scope and delivery](wuff-empire.md).

The first release focuses on lists, tasks, and ordering. It should feel fast and straightforward, without requiring scheduling or project-management concepts.

## Confirmed decisions

October 25 portal decision: `/` opens Wuff Empire's dashboard. Wuff Todo stays at
`/lists`, with existing list/task links and an Overview sidebar entry. Its saved
last-list startup preference applies only when entering Todo, never the portal.
Read-only portal previews reuse the actor's authorized Todo dashboard and section
preferences. `/totake` now opens the admitted-account Totake workspace in PR #26; its original coming-soon milestone is superseded by [Totake](totake.md). Shared navigation
does not share private app data or expand existing AI-client grants. Native Todo
keeps its existing navigation. Implementation/release evidence is recorded in the
[portal document](wuff-empire.md); production release is separate.

October 25 settings foundation: account-owned app visibility and app-summary
choices live in standalone Empire Settings, independent of Todo's list sidebar.
Global AI-client connection management uses explicit Empire scopes; GitHub/Cursor
remain under Todo. Notifications houses existing device/status controls and Todo
retains its schedule/quiet-hours settings. Hiding an app never changes data access,
notifications or client grants. See [settings contracts](empire-settings.md).

October 22 native decision: use online-only Tauri 2 with React/Vite for macOS, Windows, iPhone and Android, sharing the hosted backend and browser-compatible UI. The earlier Expo workspace was retired on October 24 at the maintainer’s request. See [Tauri development](tauri-client.md) and [platform/release gates](tauri-platforms.md). Offline task storage and queued edits remain deferred.

October 17 expansion: [work tasks and developer workflows](work-tasks-plan.md) adds optional work lists before native apps, mostly for personal work with occasional sharing. All shipped features require web/API/MCP parity. Real [GitHub App issue sync](github-sync.md) is implemented with final production release validation recorded separately; cloud-agent execution is a future explicitly authorized integration. Historical first-release deferrals below do not override this selected staged scope.

- Access is invitation-only. Public self-registration is unavailable.
- Every person has an individual account and private lists.
- Lists can be shared with other users, who can edit their tasks.
- Only a list's owner can rename or delete that list.
- Sharing must accommodate additional friends and family later, including invitations to people who do not yet have accounts.
- Web and MCP, including interactive MCP UI, ship first.
- iPhone and Android apps follow against the same backend.
- All surfaces use the same recognizable design language, with DM Sans body/headings/controls and true italics for notes; code retains monospace. [Typography delivery](typography-review.md) records local self-hosting and MCP embedding.
- Shared owner-controlled list colors theme the entire selected-list experience on web and MCP. Seven named palettes are supported; arbitrary colors and broader theme customization remain later scope. See [design language and themes](design-language.md).
- The project uses one monorepo.

## First-release scope

### Contributor feature completeness

Every new persisted-data capability must ship equivalent authorized HTTP API and
MCP operations through the same domain services, including reads to discover and
verify state. Personal settings and connection management are included. Each PR
declares its MCP App UI decision and connection/scope/consent/revocation impact,
with actual adapter and recovery evidence. Secure browser handoffs preserve secret
boundaries; parity never means exposing credentials or internal callbacks. See
[the required surface contract](guide/surfaces.md).

### Accounts and access

Each user has their own identity and session. New accounts require a valid invitation. Knowing an email address, list ID, or URL must never grant access by itself.

The first two users use an operator-only bootstrap: managed identities are provisioned through the Neon CLI, then admitted to Wuff. Each recipient requests an email code at `/set-password` and chooses their own password. Public registration stays disabled. Subsequent login uses email/password; the same email-code page handles recovery. Existing admitted accounts can now receive and accept in-app list invitations. Inviting a new person into Wuff itself remains separate operator provisioning.

### Lists

Users can create and view private lists, rename their own lists, share them, and manually order lists. Shared lists display who owns them and who has access.

**Implemented:** sidebar ordering is personal to each user. Reordering the sidebar does not change anyone else's sidebar.

**Selected October 23:** [one-level personal list nesting](personal-list-nesting.md) organizes independent lists under a parent in each account's sidebar. Parent and child retain independent sharing and tasks/subtasks; opening a parent shows only its own tasks. [Personal list favorites](personal-list-favorites.md) provide shortcuts above the tree; [personal Home](home-dashboard.md) adds a configurable welcome, dated-task overview and favorite shortcuts.

**Implemented:** archive and restore lists, with archive controlled by the owner. Archived lists retain their content and membership, and tasks/sections are read-only until restored. Permanent deletion is a separate owner-only action with an explicit confirmation explaining that it affects all members.

Implemented list colors, descriptions, sections, personal ordering, and archive/restore are specified in [mature lists](mature-lists.md). Markdown task notes are implemented in [task content and voice](task-content.md). Private images in notes are implemented in [task images](task-images.md). One-level subtasks are specified in [subtasks](subtasks.md); calendar due dates are implemented in [due dates](due-dates.md) before native mobile.

### Tasks

The initial task model has a title, list, completion state, and manual order. Users can add, rename, complete, reopen, delete, and reorder tasks in lists they may edit.

Empty or whitespace-only titles are rejected. Titles are treated as content, never executable markup or instructions.

**Proposed:** completed tasks appear in a collapsible section. Completing a task removes it from the active order; reopening appends it to the active list. Task order is shared by everyone with access to the list.

The original first release deferred task descriptions. Markdown task notes are now implemented in the next milestone; see [task content and voice](task-content.md). One-level subtasks are implemented in [subtasks](subtasks.md), with independent completion, shared sibling order and parent progress. Optional calendar due dates are implemented in [due dates](due-dates.md), independently for tasks and subtasks. Work-list priorities are implemented. Labels, shared due times and task recurrence remain deferred. Personal reminders were selected October 22; [reminder decisions](reminders.md) define the account/list/task controls and delivery gates. Private image uploads are implemented in the follow-up [task-image milestone](task-images.md).

### Sharing and invitations

**Implemented sharing permission model:**

| Action                                             | Owner                           | Editor | Non-member     |
| -------------------------------------------------- | ------------------------------- | ------ | -------------- |
| Read list and tasks                                | Yes                             | Yes    | No             |
| Add, edit, complete, reopen, delete, reorder tasks | Yes                             | Yes    | No             |
| Rename or delete list                              | Yes                             | No     | No             |
| Invite members or revoke access                    | Yes                             | No     | No             |
| Archive or restore list                            | Yes                             | No     | No             |
| Leave shared list                                  | Not without resolving ownership | Yes    | Not applicable |
| Reorder own sidebar                                | Yes                             | Yes    | Not applicable |

Owner-only rename, deletion, invitations, and access revocation are confirmed and implemented. Editors may leave. Archive/restore and personal sidebar ordering are implemented. List metadata and section management are owner-only; editors can move tasks between sections. Ownership transfer and reader-only membership are deferred.

An owner invites an existing, enabled Wuff account by email. Wuff binds the invitation to that account’s stable user ID. The recipient sees the list title and owner in their invitation inbox, then accepts or declines while signed in. An invitation never exposes tasks or grants editing access before acceptance. No invitation email is sent.

Invitations expire after seven days. Owners can cancel pending invitations, remove editors, and invite someone again after expiry, cancellation, decline, or removal. A list supports up to 100 pending invitations. Duplicate invitations do not create duplicate pending records or memberships. Identical mutation retries reuse their operation ID; retrying an old acceptance after revocation cannot restore access.

Accepted members share task changes and task order. Only the owner can manage access or rename/delete the list. Every API and MCP call checks current membership; active web screens receive live list-change signals and refresh on focus and every ten seconds as fallback. Account admission and invitations to people without accounts remain operator-only / future work.

### Web experience

The responsive [mobile website layout](mobile-web-ui.md) keeps names and editors readable, collapses list navigation on phones, and uses single-line task rows and rename fields on phones, with direct Delete and drag controls alongside a disclosure for secondary task actions. Desktop Edit/Notes controls remain direct.

Primary actions and form submissions use filled theme-colored buttons with explicit labels; secondary actions use bordered surfaces. Routine utilities favour familiar icons with accessible names/tooltips and quiet transparent treatment. Workflow/due-date statuses use non-interactive tags, with semantic urgency colors preserved. Expanded phone actions and list management have visible labels. See [design language and themes](design-language.md).

- A sidebar contains the user's accessible lists and a create-list action.
- The selected list shows its title, active tasks, and completed tasks.
- Adding a task is a short, keyboard-friendly interaction.
- List, section, and task names use inline editing with Enter/Save and Escape/Cancel, including completed tasks. Task Edit and Notes icons sit beside Delete; Notes opens the rich text editor immediately. Markdown is stored internally, without an editor mode switch. Notes accept private PNG/JPEG/WebP image uploads, paste and drop, with draft previews and explicit Save/Cancel. Drafts stay visible through save failures; name edits use existing permissions and version checks.
- Task editing and completion have clear pending, success, and failure states.
- Tasks, sections and the personal sidebar reorder using drag handles with pointer, touch and keyboard support. Web handles also open an explicit position picker on click; task deletion always requires confirmation, including tasks without subtasks. Top-level task dragging stays within its section; the task edit form changes sections. Subtasks drag within their parent, follow its section and show completed/total progress. Parent deletion explains that it removes the subtasks too.
- Calendar actions open inline date controls with Today, Tomorrow, a date picker and explicit clearing. Date badges identify due-today and overdue tasks; completed dates remain visible without urgency styling. Manual order stays unchanged.
- Sharing settings expose the owner, members, and pending invitations.
- Empty, loading, denied-access, and failed-request states are designed deliberately.
- Responsive layouts support phones before native apps arrive.

The corgi appears in the app identity and selected empty states. App-authored greetings, guidance and feedback use friendly corgi wordplay, while action labels, permissions and consequences stay explicit; user content is never rewritten. [Waffles' voice](voice.md) defines the shared web/MCP copy conventions and examples. Animation and completion celebrations are optional future design choices. Core actions remain readable, accessible, and usable without animation.

### MCP and interactive UI

An authorized AI client can discover accessible lists and perform the same permitted list/task operations as the website. Interactive MCP Apps provide list browsing, task management, and quick capture in supporting clients.

Tools return structured data and useful text independently of an embedded UI. Unsupported clients can still operate through tools. Compatibility is verified per client; universal client or UI compatibility is not promised.

AI access must never elevate the user's permissions. Duplicate tool retries must not create duplicate tasks or memberships. Destructive actions need defined, testable interaction behavior; the server must enforce authorization regardless of client confirmation UI.

## Cross-client behavior

The backend is authoritative. Active web views use Neon Realtime list/version signals to fetch current, authorized snapshots. Ten-second polling and focus/visibility refresh remain active as fallback.

**Live list updates are implemented (October 16, 2026).** Collaborator edits appear in open shared lists without a manual reload. The same mechanism applies when the user changes an open private or shared list through an authenticated ChatGPT/MCP connection: additions, edits, completion/reopening, deletion, and ordering all advance the list version. Tests exercised real authenticated MCP protocol calls and synthetic browser sessions; actual ChatGPT host usage remains a separate verification step. Current admission and membership filter the subscription, reconnects reconcile through the API, and remote refreshes preserve in-progress task input. See [live updates](live-updates.md) for design and evidence.

Concurrent edits must have a defined outcome. An outdated screen must not silently restore a task deleted by another user. Proposed conflict behavior is documented in the architecture.

**Confirmed web/offline boundary — October 15, 2026:** keep the website’s current online behavior. Do not add an offline-first PWA, service-worker caching, persistent offline list storage, or queued offline writes. Existing manifest, icons, and home-screen identity stay as they are; those assets do not imply offline support. Network failures must remain visible, and unsaved changes must never appear confirmed.

**Native decision — October 22, 2026:** Tauri in `apps/native` is the selected client for all four platforms. Persist authentication credentials securely through native storage; task snapshots and drafts remain in memory. Server access is required for list/task operations. See [native authentication](tauri-auth.md), [shared features](tauri-features.md) and [installed-platform gates](tauri-platforms.md).

## Future scope

- Native iPhone and Android apps.
- Per-list cover images, arbitrary colors and further theme customization; seven named shared app palettes are implemented.
- Richer task details and organization, if the initial users need them.
- Scheduling, reminders, recurring tasks, calendars, and integrations.
- Import/export, attachments, widgets, and share extensions.

No subscriptions, billing, enterprise workspaces, or built-in AI model usage are required for the first release. MCP allows users to bring their preferred AI client.

## Acceptance criteria

1. An uninvited visitor cannot create an account or access private application data.
2. Each initial user can create a private list that the other cannot read through web, API, or MCP.
3. An owner can invite the other user to a list; after acceptance both can edit its tasks.
4. Only the owner can rename or delete the shared list, including through direct API and MCP requests.
5. Tasks can be created, renamed, reordered, completed, reopened, and deleted through web and MCP.
6. Manual task ordering persists across reloads and is consistent for both members.
7. Revoking membership blocks subsequent reads and writes from that user across all entry points.
8. A task added through MCP appears on the website; a web change is reflected in subsequent MCP reads.
9. Retrying a mutation cannot accidentally duplicate the requested operation.
10. The interactive MCP list view works in at least one agreed supporting client, while tool-only usage works in an agreed non-UI configuration.
11. Keyboard users can create, edit, complete, and reorder tasks and understand errors.

The first end-to-end scenario is a shared grocery list: one user creates and shares it, the other adds an item, the owner reorders tasks on the web, and an authorized AI client completes an item. Both users see the same result; unrelated private lists remain private.

## First native release gate

October 18: native notes and private image viewing/upload/removal are required alongside the existing list/task/sharing foundation. GitHub writes use optional explicit browser consent; basic sign-in stays unchanged. Installed-device and physical-phone checks remain separate from protocol/bundle checks. See [pre-mobile checkpoint](pre-mobile-checkpoint.md) for accepted scope and delivery evidence.

## Personal list views

Each user can save a view of an accessible list: task title/key search, section/status/priority/assignee/due-date filters, completion visibility, grouping, sorting, section-specific sort overrides, compact/detailed rows and collapsed groups. These preferences never change shared task order or other members' views. Every preference is available through API and MCP. Subtasks remain attached to parents, with contextual matches explained. See [personal views](personal-views.md). GitHub synchronization is released; online-only native apps are now in development.

## Totake and shared notifications — October 25

[Totake](totake.md) implements the reviewed handover inside Empire: personal
medication/equipment schedules, stable expected occurrences, recorded/Skip/Undo,
selected snooze, PRN intake and count-only inventory. No medical sharing or dosing
advice. Dedicated Totake consent is required; old Todo grants do not expand.
The portal summary is opt-in and omits medicine names. Global notification settings
now have real account/app pauses and content privacy; Totake keeps its own repeat
rules. Actual native delivery and watch interactions remain release gates.
