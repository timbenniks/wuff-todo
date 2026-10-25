# Empire Settings foundation

October 25, 2026. Implemented and verified locally on PR #25. This implements
phase 1 of [the settings plan](empire-settings-plan.md), before Totake. Notification
master/per-app pauses and medicine behavior remain the later planned phases.

## Brief and acceptance

Active instructions: root/web AGENTS.md, contributor workflow and wuff-contributor,
product/architecture and guide design/accessibility/surface rules. Keep the existing
portal branch/PR; unrelated dependency-file edits remain excluded.

- Global Settings uses its own desktop navigation/mobile selector, with no Todo
  list catalogue, invitation or live-subscription dependency. `/settings` opens
  `/settings/apps`; all-hidden accounts can always reach Manage apps and Settings.
- Personal app visibility affects menu/card visibility; dashboard summary choices
  are independent and app visibility takes precedence. Todo/Totake stay visible
  by default, with only Todo contributing a summary. Hidden apps retain data,
  direct authorized URLs, notifications and connections. Future/unknown saved
  choices are preserved but cannot render or grant an unregistered capability.
- Todo overview/startup preferences stay Todo-owned. Native Todo still opens its
  own workspace and hands hosted account Settings to the browser.
- AI client connections are global. GitHub and Cursor are under Todo. Account,
  shared notification devices/status, Todo schedules, Totake coming soon and Docs
  have dedicated destinations. Existing links/query/#cursor aliases remain usable.
- Explicit Save/Cancel, separate revisions, original-version conflict drafts and
  exact operation-ID retries apply to app settings. Remote refresh does not rebase
  dirty drafts. Failed background preference refresh keeps drafts and reports the
  failure; account changes remain pinned and cannot write another account.

## Contracts and storage

`packages/contracts/src/empire.ts` supplies one typed app catalogue and validated
patch contracts. `wuff_empire_preferences` has one account-owned row, an independent
revision and JSON app choices. Patch requests change only named fields, preserve
omitted/future entries, reject duplicate/unknown app changes and reject a Totake
dashboard summary before one exists. No Todo preferences or shared versions change.
Domain writes serialize on the admitted account and use existing actor-scoped
mutation receipts. Admission/scopes are rechecked before receipt replay.

| Capability | Domain | HTTP | MCP | Native bearer action |
| --- | --- | --- | --- | --- |
| Catalogue and personal choices | getEmpireSettings | GET /api/v1/empire | get_empire_settings; show_empire_settings | getEmpireSettings |
| Patch choices | updateEmpireSettings | PUT /api/v1/empire | update_empire_settings | updateEmpireSettings |
| Actual AI grants/status | getAiConnections | GET /api/v1/connections | get_ai_connections | getAiConnections |
| Revoke AI grants | disconnectAiClient | DELETE /api/v1/connections | disconnect_ai_client | disconnectAiClient |
| Existing notification status/devices | getReminderSettings | GET /api/v1/reminders | get_reminder_settings, including setupPath | getReminderSettings |
| Remove own device | removeReminderDevice | POST /api/v1/reminders, action removeDevice | remove_reminder_device | removeReminderDevice |

The MCP App renders app/summary checkboxes with explicit Save/Cancel, read-only
scope handling, conflict recovery and exact uncertain-save retry. Tool-only clients
receive complete structured data. Device registration requires actual OS/browser
permission and secure native/browser setup; `get_reminder_settings` supplies safe
device status/IDs and `/settings/notifications` for that handoff. Device addresses,
subscription keys and provider credentials never enter MCP output. Existing
reminder writes/scopes and notification scheduling semantics are retained.

## Connections and consent

New `empire:read` and `empire:manage` scopes authorize personal app settings and
global AI-client connection management. Consent explicitly describes reading
connection permissions and disconnecting clients. MCP clients can request only
Empire scopes without Todo access; native grants retain their existing required
`lists:read` and may explicitly request Empire scopes. Old defaults, stored grants
and refresh behavior are unchanged. Clients need a new explicit grant to use the
new capabilities; no Totake data scope exists yet.

Connection status aggregates only unrevoked grants for the actor; expired refresh
grants never appear as active scope authority. Responses expose names, scope names
and authorized/expired state, never token material. Fixed native client IDs can be
revoked too. Revocation uses shared domain services across HTTP/MCP/native, with
actor-scoped receipts; an identical old retry does not revoke a newer consent.
Legacy HTTP callers may omit operationId for backwards compatibility; new UIs and
tools use exact IDs for recovery. Provider GitHub/Cursor consent is unaffected.

## Routes and notification scope

Global: `/settings/apps`, `/settings/dashboard`, `/settings/notifications`,
`/settings/connections`, `/settings/account`. Todo: `/settings/todo`,
`/settings/reminders`, `/settings/todo/github`, `/settings/todo/cursor`.
`/settings/totake` is explanatory only. `/connections` and old Connections
listId/#cursor links reach the Todo Cursor section; `/github` preserves listId/error
while redirecting to the Todo GitHub section. Public Docs remains public;
`/settings/docs` uses the global shell.

Notifications exposes existing safe delivery/device controls; Todo keeps daily
schedule/quiet-hours/title-privacy forms. No master switch is simulated and no
provider is activated. Global/app pause enforcement and a shared cross-app job
envelope are future work before Totake delivery, not a hidden change to current jobs.

## Migration and release boundaries

Drizzle migration `0018_empire_preferences.sql` only creates the preferences table
and its foreign key to application-owned users. Tim explicitly authorized applying
it everywhere. Applied first to the isolated development direct connection, with
domain concurrency/retry/isolation validation, then production through the direct
connection after validating that only this migration was pending. Production
columns and unchanged existing account/list/task counts were read back. No auth
tables, existing app rows, provider settings or production application deployment
were changed. This schema execution is separate from PR review/merge/release.

Unit plan: defaults, unknown/duplicate/invalid patch boundaries, omission/future
preservation, OAuth scope defaults and expiry-aware safe connection summaries.
Actual adapter tests cover both write/read directions, native bearer separation,
account/origin/scope rejection, legacy refresh and revocation. Browser/SDK tests
exercise drafts/retries, hide/restore, direct links, responsive settings and the
real embedded controls. Commands/evidence are in `verification.md` and PR.

Local results: 134 unit tests, 6 real development integration tests, typecheck,
optimized web/MCP build and native frontend build pass. New settings browser/SDK,
existing portal and updated workspace regression harnesses pass. The SDK uses the
existing host-safe form handler because host sandboxes block native form submit.
An exposed Todo navigation regression is fixed: unconfirmed list IDs stay out of
browser history; their workspace retry becomes a real URL only on acknowledgement.
The workspace create-response-loss test now exercises that recovery inside Todo,
where list creation belongs after Settings becomes independent.

Screenshots: [desktop](screenshots/empire-settings-1280.png),
[320px](screenshots/empire-settings-320.png),
[390px](screenshots/empire-settings-390.png), and
[local MCP SDK host](screenshots/empire-settings-mcp-390.png).
Production app release, installed native/device delivery, assistive technology
and named MCP-host acceptance remain separate. No notification provider or paid
execution was activated. Keep the PR draft while required remote checks are blocked.
