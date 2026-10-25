# Shared Empire settings and personal app choices

October 25, 2026. Phase 1 is implemented and verified locally before Totake in PR #25; see
[implementation and delivery boundaries](empire-settings.md). PR #26 now implements the phase 2 pause/privacy controls and phase 3 Totake data/UI registration; native device delivery remains a release gate. This document retains the full staged design.

## Goal and navigation

Give each person one Settings area for their Wuff account, app choices and shared
services, with dedicated sections for each app. Settings must use the Empire
frame and its own navigation, without loading Todo's lists, invitations or live
subscription. It remains reachable when all apps are hidden.

```text
Settings
  Your apps                 Show/hide apps in your Empire
  Dashboard                 Choose app summaries to show
  Notifications             Shared device/delivery controls and per-app status
  AI & MCP connections      Client permissions, status and revoke
  Account                   Existing sign-in/password/sign-out actions

App settings
  Wuff Todo
    Overview                Existing section/startup preferences
    Reminders               Todo digest and task/list reminder rules
    GitHub                  Personal connection and owned Work-list bindings
    Cursor                  Personal connection and Work environments
  Wuff Totake               Coming soon; no pretend medicine settings

Help
  Docs
```

Use real app-owned forms inside a shared layout, not a universal form/schema
builder. Keep task/list contextual settings inside Todo where they are useful;
central settings provide an account-level home and links to those controls.

## Personal app choices

Label the main action **Show in my Empire**, avoiding an ambiguous Enable switch.
It controls that person's app card and app-menu entry. App dashboard visibility
is a separate choice, with the app visibility switch taking precedence. Hidden
apps remain discoverable through Settings / Your apps or a permanent Manage apps
link. The dashboard has a useful all-hidden state and a route back to Your apps.

Hiding an app does not delete data, revoke membership, disable direct authorized
URLs, pause notifications or revoke AI/provider connections. Explain that next to
the control and link to Notifications and Connections. Each member has their own
preferences. Standalone native Todo's navigation/startup remains independent.

Preserve the initial Todo/coming-soon Totake presentation for existing accounts
until they change it. New apps appear in the app catalogue; they do not acquire
notification or AI permission merely by being added to the registry. Future apps
should require an explicit choice before contributing personal dashboard content.

The portal has app-level summary choices. Todo's existing Today/Coming up/Favorites
settings remain Todo-owned; they are not renamed into generic Empire preferences.
Initially the Todo summary continues to respect those choices, without migration
or resetting anyone's existing overview/startup preferences.

## Shared services and app boundaries

### AI and MCP

Manage client connections globally, showing the actual app capabilities granted
to each client. Reuse the current identity, endpoint, token store and revocation
mechanisms. The existing list/task scopes continue to mean Todo capabilities;
moving their UI does not rename or expand them. New global preference operations
need explicit Empire preference scopes rather than automatically treating
`lists:manage` as authority over every app. Scope names are selected in the
implementation contract, with backwards-compatible existing grants.

Before Totake data is exposed, define dedicated Totake read/write capabilities
and explicit consent. Existing Todo grants cannot gain them via token refresh.
Connection revocation applies on subsequent reads/writes and retry receipts.
Changing individual app grants must use a real, tested consent/revocation flow;
do not render unchecked boxes that fail to restrict existing access tokens.

GitHub and Cursor belong under Todo settings for now. Preserve personal provider
credentials, owner-controlled list bindings and explicit paid-execution gates.
Shared lists and shared Settings navigation grant no access to another member's
provider credentials, medicine information or AI-client connections.

### Notifications

The shared layer owns device registrations, OS/browser permission status, safe
delivery adapters and account-wide delivery controls. App sections own event
meaning and schedules: Todo's daily digest, task reminders and list inclusion;
future Totake's medicine schedules and acknowledgement rules.

The current reminder preferences combine timezone/quiet hours with Todo-specific
daily settings and title privacy. Split those responsibilities additively, with
compatibility adapters for existing web/native/MCP contracts. Do not relabel a
Todo daily nudge as a global notification master switch.

A genuine global pause must be enforced by delivery callbacks, as well as by
scheduling/UI; app-specific pauses must also be enforced. Preserve schedules and
show Paused accurately. Define resume/reconciliation before implementation so it
does not release a backlog of stale reminders. Device registration, saved
preferences, OS permission, configured providers and confirmed delivery must
remain distinct states. Medication quiet-hour/missed-reminder behavior is a
separate Totake product decision; never silently inherit Todo's delay rules.

Reuse current delayed-job and device infrastructure. Add app identity/authorized
target dispatch when a second app actually needs delivery. Each app rechecks its
own actor/object access; Todo jobs retain their existing cancellation and retry
semantics. No speculative notification-engine rewrite or provider activation.

## Implementation sequence

### 1. Empire settings and personal app selection — build before Totake

- Replace Settings' `ListApp` dependency with an admitted-account Empire settings
  shell; `/settings` opens Your apps. Global settings load without Todo data.
- Extend the existing static app registry with settings destinations, status and
  dashboard contribution metadata. Keep it explicit and typed.
- Add independently versioned, account-owned app/dashboard visibility preferences.
  Mutations patch named preferences, preserve omitted/unknown future app settings,
  use operation IDs and reject known unavailable options. Saved unknown app IDs
  never render a capability or grant authorization.
- Apply visibility consistently to app cards, menu entries and portal summaries.
- Separate the existing AI client manager from Todo GitHub/Cursor pages, retaining
  all existing provider and consent behavior. No new cross-app grants yet.
- Preserve `/connections`, `/settings/connections`, `/settings/reminders`, `/github`
  and existing listId/query/#cursor links with explicit compatibility routes.
- Retain the existing Todo reminder form under Todo. Global Notifications can
  expose accurate existing device/status controls and a clear Todo destination;
  do not ship nonfunctional master/per-app switches.
- Expose the new catalogue/preference read and write capabilities through shared
  contracts/domain services, HTTP, MCP and appropriate native adapters. Provide
  an MCP App view for selecting app/dashboard visibility, plus complete tools.

### 2. Shared notification preferences — finish before Totake delivery

Extract global device/delivery settings and implement real account/per-app pauses
with callback enforcement, additive migration/backfill, legacy adapter parity and
explicit resume behavior. Retain Todo schedules and defaults. Do not activate a
provider or change production delivery as part of preparing this code.

### 3. Totake registration — alongside the actual app

Register Totake's real settings/screens, authorized dashboard summary, dedicated
domain/API/MCP operations and explicit app scopes. Add its notification categories
and schedule reconciliation after its reminder/privacy rules are agreed. Its
coming-soon page alone does not justify a medicine schema or consent grant.

## Acceptance and evidence

Test personal choice isolation between two synthetic users; hide/restore each app;
all-hidden recovery; direct links to hidden apps; unknown/new app IDs; saved
preferences on reload/another client; default preservation; stale versions,
concurrent changes and identical mutation retries. Verify API-write/MCP-read and
MCP-write/web-or-API-read with actual adapters, including scopes and revoked grants.

Check Settings has no Todo catalogue/live-subscription dependency and remains
usable without Todo data. Preserve drafts on conflict/failure, and verify old
routes/query/fragment links, keyboard/focus, 320/390px overflow and desktop layout.
Native browser handoff and native preference adapters require explicit evidence;
web builds alone do not certify an installed native app.

For notification changes, test global/per-app pause at callback execution,
already-queued messages, resume/no stale burst, device removal, quiet hours/DST,
account changes and access revocation with synthetic data and mocked providers.
Do not equate mocked provider acceptance with real delivery.

Run meaningful unit tests, typecheck, relevant integration/UI checks and required
builds. Prepare schema/authorization/consent changes for review in a draft PR.
Migration execution, provisioning, production operations and paid runs retain
their explicit operational-authorization gates. No deployment or migration is
authorized by approving this plan alone.
