# Wuff Todo product specification

Status: working specification, version 0.1

Updated: October 17, 2026

## Purpose

Wuff Todo helps friends and family manage simple private and shared lists. The initial users are the owner of this project and his wife. A small corgi avatar gives the product its identity.

The first release focuses on lists, tasks, and ordering. It should feel fast and straightforward, without requiring scheduling or project-management concepts.

## Confirmed decisions

October 17 expansion: [work tasks and developer workflows](work-tasks-plan.md) adds optional work lists before native apps, mostly for personal work with occasional sharing. All shipped features require web/API/MCP parity. Real GitHub App sync is planned; cloud-agent execution is a future explicitly authorized integration. Historical first-release deferrals below do not override this selected staged scope.

- Access is invitation-only. Public self-registration is unavailable.
- Every person has an individual account and private lists.
- Lists can be shared with other users, who can edit their tasks.
- Only a list's owner can rename or delete that list.
- Sharing must accommodate additional friends and family later, including invitations to people who do not yet have accounts.
- Web and MCP, including interactive MCP UI, ship first.
- iPhone and Android apps follow against the same backend.
- All surfaces use the same recognizable design language.
- Shared owner-controlled list colors are implemented before mobile; images and broader themes follow later.
- The project uses one monorepo.

## First-release scope

### Accounts and access

Each user has their own identity and session. New accounts require a valid invitation. Knowing an email address, list ID, or URL must never grant access by itself.

The first two users use an operator-only bootstrap: managed identities are provisioned through the Neon CLI, then admitted to Wuff. Each recipient requests an email code at `/set-password` and chooses their own password. Public registration stays disabled. Subsequent login uses email/password; the same email-code page handles recovery. Existing admitted accounts can now receive and accept in-app list invitations. Inviting a new person into Wuff itself remains separate operator provisioning.

### Lists

Users can create and view private lists, rename their own lists, share them, and manually order lists. Shared lists display who owns them and who has access.

**Implemented:** sidebar ordering is personal to each user. Reordering the sidebar does not change anyone else's sidebar.

**Implemented:** archive and restore lists, with archive controlled by the owner. Archived lists retain their content and membership, and tasks/sections are read-only until restored. Permanent deletion is a separate owner-only action with an explicit confirmation explaining that it affects all members.

Implemented list colors, descriptions, sections, personal ordering, and archive/restore are specified in [mature lists](mature-lists.md). Markdown task notes are implemented in [task content and voice](task-content.md). Private images in notes are implemented in [task images](task-images.md). One-level subtasks are specified in [subtasks](subtasks.md); calendar due dates are implemented in [due dates](due-dates.md) before native mobile.

### Tasks

The initial task model has a title, list, completion state, and manual order. Users can add, rename, complete, reopen, delete, and reorder tasks in lists they may edit.

Empty or whitespace-only titles are rejected. Titles are treated as content, never executable markup or instructions.

**Proposed:** completed tasks appear in a collapsible section. Completing a task removes it from the active order; reopening appends it to the active list. Task order is shared by everyone with access to the list.

The original first release deferred task descriptions. Markdown task notes are now implemented in the next milestone; see [task content and voice](task-content.md). One-level subtasks are implemented in [subtasks](subtasks.md), with independent completion, shared sibling order and parent progress. Optional calendar due dates are implemented in [due dates](due-dates.md), independently for tasks and subtasks. Work-list priorities are implemented. Labels, due times, recurrence, and reminders remain deferred. Private image uploads are implemented in the follow-up [task-image milestone](task-images.md).

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

Routine controls favour familiar icons, accessible names and tooltips over repeated button words. Use quiet neutral/transparent buttons rather than solid-blue blocks. Keep meaningful date choices, consequence explanations and error/retry guidance readable.

- A sidebar contains the user's accessible lists and a create-list action.
- The selected list shows its title, active tasks, and completed tasks.
- Adding a task is a short, keyboard-friendly interaction.
- List, section, and task names use inline editing with Enter/Save and Escape/Cancel, including completed tasks. Task Edit and Notes icons sit beside Delete; Notes opens the rich text editor immediately. Markdown is stored internally, without an editor mode switch. Notes accept private PNG/JPEG/WebP image uploads, paste and drop, with draft previews and explicit Save/Cancel. Drafts stay visible through save failures; name edits use existing permissions and version checks.
- Task editing and completion have clear pending, success, and failure states.
- Tasks, sections and the personal sidebar reorder using drag handles with pointer, touch and keyboard support. Top-level task dragging stays within its section; the task edit form changes sections. Subtasks drag within their parent, follow its section and show completed/total progress. Parent deletion explains that it removes the subtasks too.
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

Revisit offline behavior when planning the React Native/Expo iPhone and Android apps. The user has mixed experiences with PWAs and offline-first systems, so native offline support is an open product decision, not an assumed requirement. Compare online-only operation, cached read access, and queued offline editing against actual mobile use cases before choosing. This deliberation does not add offline behavior to the implemented live updates for connected web views, including changes made through MCP.

## Future scope

- Native iPhone and Android apps.
- Per-list cover images and broader themes; named shared colors are implemented.
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

## Personal list views

Each user can save a view of an accessible list: task title/key search, section/status/priority/assignee/due-date filters, completion visibility, grouping, sorting, section-specific sort overrides, compact/detailed rows and collapsed groups. These preferences never change shared task order or other members' views. Every preference is available through API and MCP. Subtasks remain attached to parents, with contextual matches explained. See [personal views](personal-views.md). GitHub synchronization and native apps remain later milestones.
