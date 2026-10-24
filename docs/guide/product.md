# What Wuff does today

Wuff Todo helps friends and family manage private and shared lists. It also has an optional Work mode for development tasks. Keep everyday lists fast and approachable; richer features should not make every simple task feel like project management.

## Lists and tasks

- Private lists or shared lists with accepted editors; personal sidebar order.
- List descriptions, seven owner-selected colors, sections, archive/restore.
- Tasks with inline names, explicit completion/reopening, shared manual ordering and one level of subtasks. Children have independent completion; deleting a parent also deletes its children.
- Rich notes stored as Markdown, private note images, explicit Save/Cancel and retained drafts when a save fails or remote content changes.
- Optional calendar due dates, including Today/Tomorrow/custom/clear. A date is not a shared due time. Completing a task removes urgency styling; reopening appends it to the active order.
- Personal views: filtering, grouping, sorting, density and collapsed groups. These do not change someone else’s view or shared manual order. Dragging is unavailable under computed sorting.
- Optional Work lists: Todo, In progress, In review, Blocked, Done; priority, one assignee, external references, stable task links and WUFF keys.

## Permissions are part of the design

| Action                                      | Owner                      | Accepted editor | Non-member     |
| ------------------------------------------- | -------------------------- | --------------- | -------------- |
| Read tasks and notes                        | Yes                        | Yes             | No             |
| Add/edit/complete/delete/reorder tasks      | Yes                        | Yes             | No             |
| Rename/delete/archive list                  | Yes                        | No              | No             |
| Change shared metadata, colors and sections | Yes                        | No              | No             |
| Invite or remove people                     | Yes                        | No              | No             |
| Move a task to an existing section          | Yes                        | Yes             | No             |
| Change own view and reminder preferences    | Yes                        | Yes             | No             |
| Leave the shared list                       | Ownership must be resolved | Yes             | Not applicable |

Access is invite-only. Existing admitted people accept account-bound invitations before seeing tasks; a URL or email does not grant access. Reader-only membership, ownership transfer and public self-registration are not current features.

## Collaboration and integrations

Open screens refresh after list changes, including changes through MCP. Remote updates must preserve unsaved input and offer recovery from conflicts. Failed or uncertain saves never look confirmed.

GitHub linking and issue synchronization exist for owner-authorized repositories. Personal Cursor connections and agent controls exist, but paid execution has a separate operational gate. Shared-list membership never grants someone else’s credentials or credits.

Personal reminders and Settings are implemented. Scheduling, delivery-provider configuration and installed-device notification delivery are separate capabilities: a saved preference is not evidence that a notification can be delivered. Reminder times and daily inclusion are personal; they are not shared task due times.

## Surfaces and boundaries

The responsive website and MCP tools use the same authorized backend; the MCP App adds an embedded interface. An online-only Tauri client shares React components; installed-platform capabilities still need platform-specific proof. A browser preview is not a native build or a live MCP-host test.

No offline list cache or queued offline edits. No arbitrary palette colors, dark mode, recurring tasks, multi-level subtasks or new admission model by default. These can be proposed as new scope, with their implications explained rather than presented as already supported.

These are implementation invariants. Clearly mark proposed changes and get Tim’s technical scope approval before changing them.

## Current interaction language

Saved views are personal to each list. Save view updates the current view; Save as
new view creates a named view. Shared list settings separate List details, People,
Only for me and Manage list. Home completion and task-title navigation are separate.
Date shortcuts and Clear date change a draft; Save date commits it.
