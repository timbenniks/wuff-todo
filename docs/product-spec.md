# Wuff Todo product specification

Status: working specification, version 0.1  
Updated: October 15, 2026

## Purpose

Wuff Todo helps friends and family manage simple private and shared lists. The initial users are the owner of this project and his wife. A small corgi avatar gives the product its identity.

The first release focuses on lists, tasks, and ordering. It should feel fast and straightforward, without requiring scheduling or project-management concepts.

## Confirmed decisions

- Access is invitation-only. Public self-registration is unavailable.
- Every person has an individual account and private lists.
- Lists can be shared with other users, who can edit their tasks.
- Only a list's owner can rename or delete that list.
- Sharing must accommodate additional friends and family later, including invitations to people who do not yet have accounts.
- Web and MCP, including interactive MCP UI, ship first.
- iPhone and Android apps follow against the same backend.
- All surfaces use the same recognizable design language.
- List customization with images, colors, and themes is future scope.
- The project uses one monorepo.

## First-release scope

### Accounts and access

Each user has their own identity and session. New accounts require a valid invitation. Knowing an email address, list ID, or URL must never grant access by itself.

The first two users need a controlled bootstrap path. The exact initial-account provisioning method and sign-in methods remain open.

### Lists

Users can create and view private lists, rename their own lists, share them, and manually order lists. Shared lists display who owns them and who has access.

**Proposed:** sidebar ordering is personal to each user. Reordering the sidebar does not change anyone else's sidebar.

**Proposed:** archive and restore lists, with archive controlled by the owner. Permanent deletion is a separate owner-only action with an explicit confirmation explaining that it affects all members.

### Tasks

The initial task model has a title, list, completion state, and manual order. Users can add, rename, complete, reopen, delete, and reorder tasks in lists they may edit.

Empty or whitespace-only titles are rejected. Titles are treated as content, never executable markup or instructions.

**Proposed:** completed tasks appear in a collapsible section. Completing a task removes it from the active order; reopening appends it to the active list. Task order is shared by everyone with access to the list.

Task descriptions, subtasks, labels, priorities, dates, recurrence, and reminders are outside the first release.

### Sharing and invitations

**Proposed permission model:**

| Action                                             | Owner                           | Editor | Non-member     |
| -------------------------------------------------- | ------------------------------- | ------ | -------------- |
| Read list and tasks                                | Yes                             | Yes    | No             |
| Add, edit, complete, reopen, delete, reorder tasks | Yes                             | Yes    | No             |
| Rename or delete list                              | Yes                             | No     | No             |
| Invite members or revoke access                    | Yes                             | No     | No             |
| Archive or restore list                            | Yes                             | No     | No             |
| Leave shared list                                  | Not without resolving ownership | Yes    | Not applicable |
| Reorder own sidebar                                | Yes                             | Yes    | Not applicable |

Owner-only rename and deletion are confirmed. The remaining permission details are proposed defaults. Ownership transfer and reader-only membership are deferred.

**Proposed invitation behavior:** an owner invites an email address to a list. An existing user accepts while signed in to the matching verified identity. A new user can establish an account using the invitation, then accept list membership. An invitation does not expose list contents before acceptance.

Invitations should expire, be revocable, and be safe to accept only once. Repeating an already successful acceptance should return the existing membership rather than create duplicates. Owners can see pending invitations. Email delivery and the policy for who may invite new users still need decisions.

### Web experience

- A sidebar contains the user's accessible lists and a create-list action.
- The selected list shows its title, active tasks, and completed tasks.
- Adding a task is a short, keyboard-friendly interaction.
- Task editing and completion have clear pending, success, and failure states.
- Reordering works with pointer, touch, and keyboard controls.
- Sharing settings expose the owner, members, and pending invitations.
- Empty, loading, denied-access, and failed-request states are designed deliberately.
- Responsive layouts support phones before native apps arrive.

The corgi appears in the app identity and selected empty states. Animation and completion celebrations are optional future design choices. Core actions remain readable, accessible, and usable without animation.

### MCP and interactive UI

An authorized AI client can discover accessible lists and perform the same permitted list/task operations as the website. Interactive MCP Apps provide list browsing, task management, and quick capture in supporting clients.

Tools return structured data and useful text independently of an embedded UI. Unsupported clients can still operate through tools. Compatibility is verified per client; universal client or UI compatibility is not promised.

AI access must never elevate the user's permissions. Duplicate tool retries must not create duplicate tasks or memberships. Destructive actions need defined, testable interaction behavior; the server must enforce authorization regardless of client confirmation UI.

## Cross-client behavior

The backend is authoritative. A change made through MCP is visible on the website, and vice versa. The initial refresh strategy and acceptable propagation delay must be chosen and tested before release.

Concurrent edits must have a defined outcome. An outdated screen must not silently restore a task deleted by another user. Proposed conflict behavior is documented in the architecture.

Native mobile offline editing is deferred. The first web release should show network failures clearly and never imply that an unsaved change succeeded.

## Future scope

- Native iPhone and Android apps.
- Per-list images, custom colors, and themes; ownership and shared-versus-personal appearance rules remain undecided.
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
