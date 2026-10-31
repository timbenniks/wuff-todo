# What Wuff does today

New products are Empire modules. Read [Product modules](/docs/modules) for source
ownership, contribution points and the Todo/Totake reference implementations.

Empire Settings has its own navigation, independent of Todo. Personal Your apps
and Dashboard choices control app launchers and summaries. Hiding keeps data,
notifications and connections; AI access needs explicit app/service permissions.
AI clients and notification devices/status are global; Todo owns its schedules,
GitHub and Cursor settings. Global and per-app pauses are enforced by the delivery callbacks. Totake owns its medication/equipment repeat and recording rules. Real installed notification delivery remains a release gate.

Wuff Empire is the shared web portal at `/`, with an app menu and a personal
dashboard. Wuff Todo stays at `/lists`; Wuff Totake opens its private medication/equipment workspace. Its optional portal summary shows counts and reminder-group links without medicine names. Todo previews reuse authorized Todo reads.
App navigation never grants access to another person's private information or
expands an existing connection's permissions. Web Todo's Overview is the existing
Home view; MCP keeps Home. The portal and Todo startup preferences are
separate: opening `/` always opens the portal.

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

The responsive website and MCP tools use the same authorized backend; the MCP App adds an embedded interface. Installable PWAs use the responsive web application. Tauri/native apps are retired. Browser checks do not prove physical-device push delivery or a named MCP-host integration.

No offline list cache or queued offline edits. Todo offers Light (default), Dark and System appearance with its original approved list palettes; the appearance choice stays on this device. No arbitrary palette colors, recurring tasks, multi-level subtasks or new admission model by default. These can be proposed as new scope, with their implications explained rather than presented as already supported.

Preserve these defaults unless the feature deliberately changes them. Explain proposed product changes in the PR; admission, access and privacy changes need explicit review in the PR before merge. Contributors can prepare and test code without preliminary approval.

## Current interaction language

Saved views are personal to each list. Save view updates the current view; Save as
new view creates a named view. Shared list settings separate List details, People,
Only for me and Manage list. Home completion and task-title navigation are separate.
Date shortcuts and Clear date change a draft; Save date commits it.

In Settings → AI & MCP connections, each MCP client has app/service switches and
an advanced individual tool list. These choices only narrow the existing OAuth
grant and are separate from menu visibility. Connection controls stay available
when authorized. AI clients can turn tools off; the owner re-enables them in
Settings. After saving, refresh the client tool catalog; cached disabled calls
are blocked immediately. Newly added optional tools stay off after a selection.

## Todo discovery and personal hierarchy

Todo Overview presents Today/Coming up, followed by the complete active list catalog.
Favorites supplement the canonical tree: do not remove starred lists from their
parent or promote children solely because their parent is a favorite. Parent
pages expose child lists; child pages expose only the current viewer's authorized
parent/siblings. List nesting is personal organization, never permission or task
inheritance. The desktop width is an account-specific device layout preference.

## Todo productivity navigation

Favorites are flat shortcuts with parent context where needed, while Your lists
is the only hierarchical tree. List actions and sidebar width reset use contextual
popovers. The Overview prioritizes Today/Coming up, then a compact searchable list
browser. The title-led workspace keeps Search/Filter/View visible and exposes
advanced view configuration together. Use the scoped inline composer and task
drawer rather than permanent large forms. See the
[focused redesign](../todo-productivity-redesign.md) for interaction invariants.
