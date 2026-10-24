# UX improvement programme

October 24, 2026. Approved direction: implement in phases from the complete UX audit.

## Baseline and purpose

Make the daily loop — add, find, open, update, complete, return — easier across
Basic and Work lists. Preserve Wuff's palettes, DM Sans, compact controls and
Waffles. This is an interaction improvement programme using the existing shared
components, not a parallel design system.

Source: the October 24 revision-2 report, `audit-data.json`, capture README and
manifest in `/Users/timbenniks/Desktop/wuff-ux-audit-complete`. Its 61 screen
families, 117 viewport captures and 184 PNGs describe optimized local commit
`94c0b00`. Screenshots support layout observations; they do not certify runtime
accessibility, production, delivery providers or installed clients.

Current-source corrections: task titles already open details; the compact phone
header and View sheet already exist locally. Improve discoverability and those
components rather than implementing duplicate navigation. Captured waiting states
and the remaining Basic-page session warning require interaction checks before
being classified as persistent defects.

## Invariants

- Invite-only access; owner-only list administration; existing editor membership.
- Personal views, sidebar organisation, reminders and credentials stay personal.
- Domain permissions, list versions, exact-request retries and shared ordering
  remain authoritative. Never report a save before acknowledgement.
- Keep drafts after failed/uncertain saves and remote conflicts. Prevent duplicate
  submissions and use the existing retry operation for uncertain outcomes.
- Use shared web/Tauri components and maintain API/MCP semantics. Web layout
  evidence does not establish embedded-host or installed-native equivalence.
- Preserve explicit Save/Cancel, independent completion, one-level subtasks and
  non-drag reorder controls. Common touch actions retain 44px targets.
- No recurrence, public registration, reader roles, ownership transfer, offline
  caches/queues or automatic paid execution is introduced by this programme.

## Phases and acceptance gates

Each phase ends with documented implementation/verification evidence before the
next phase starts. Local completion and production release are separate states.

### Phase 1 — capture, phone titles and filter recovery

Audit F01, F02 (readability), F06. First implementation slice.

1. Provide one stable **Add task** entry in the desktop view toolbar and a labeled
   bottom phone action, available without scrolling through a long list. Reserve
   space so the phone action does not cover the last task/composer.
2. Open a focused title-first capture dialog showing the destination list and an
   optional section. Retain section-level inline capture. No cross-list capture
   is needed until Home in Phase 3. Closing keeps an unfinished draft for the
   current mounted list; switching lists/reloading does not promise persistence.
3. Validate nonblank titles, preserve failed drafts, prevent duplicate submission,
   and expose existing exact-request retry inside the modal. Clear the form only
   after acknowledged success. Archived lists offer no capture entry.
4. Allow two-line phone task titles independently of density. Preserve desktop
   column geometry, full accessible names and title-to-details behavior.
5. Expose active-filter chips and **Clear filters** on phones as well as desktop.
   Clearing resets search/section/status/priority/assignee/due/completion filters,
   preserving grouping, sorting, density, columns and saved-view definitions.
   Clearing previews a personal view; **Save view** remains explicit.
6. Distinguish no tasks from no matches, show result counts, and distinguish view
   drafts from task-save state. On creation under active filters, explain that
   filters still apply and may hide the new task; never claim a failed save worked.

Gate: Basic/Work at 320/390/desktop; long-list capture without end scrolling;
destination correctness; one task per submission; failure/retry draft retention;
archived restrictions; two-line title geometry and independent completion/detail
targets; zero-results recovery; clearing preserves non-filter preferences;
existing saved-view conflict/retry and responsive checks remain green.

### Phase 2 — mobile navigation, View and task details

Audit F02 (discoverability), F03, F05; navigation/create-list/detail reviews.

- Labeled Lists trigger opens a dedicated mobile navigation sheet with current
  selection, full names and predictable close/return position. Create list gets
  a short focused form, Basic/Simple default, and task-composer focus on success.
- View uses replacement subpages or inline sections within one active sheet:
  Back returns within it, Done closes it, Save view persists its draft. Replace
  nested floating panels; keep in-panel conflict/retry feedback.
- Make phone Work status/assignee summaries useful; move status, priority and
  assignment near the detail title, before notes. Expose Change status alongside
  completion and keep Done consistent with completion across all adapters.
- Keep substantial notes editing in the existing detail surface, reachable Save
  controls, subtask progress, full content and stable return to the list.

Implementation decisions for this phase:

- The existing sidebar content is shared between the desktop sidebar and a native
  modal Lists sheet on phones. Full names wrap; opening navigation leaves the
  task canvas in place and preserves the sheet's independent scroll position.
- Create list replaces the phone navigation content (or opens a short desktop
  dialog). Simple is the default; an unfinished name/type draft survives closing
  and Back. The existing pending-create operation retains its mode on exact
  retries, and acknowledged creation opens task capture for the new list.
- Filter/Sort/Group/Display/Presets use named regions within the single View
  dialog on phones. Back returns to the root and Done closes the dialog; Save
  view remains explicit. Desktop retains focused popovers. Desktop-only column
  configuration is omitted from the phone Display page.
- Work details occur before Notes in source order and on phones, while the wide
  standalone task page keeps its right-hand Work/context column. Status editing
  uses the same Work form and never saves an independent open notes draft.
- Native modal/inert behavior is supplemented by explicit first/last keyboard
  focus wrapping in Lists, View, task details and capture. Closing restores the
  originating control; task-details dirty-exit confirmation remains authoritative.

Gate: keyboard/touch open → edit → save/cancel → return; one active modal context;
focus entry/containment/return, dirty drafts, long notes/references, resize and
phone keyboard; In progress → In review without scrolling through notes.

### Phase 3 — actionable Home and completion flow

Audit F04; Basic/completed/subtask reviews.

- Compact Today-first Home with independent completion and task-title navigation,
  source-list context and Add task with an explicit editable destination list.
- Quiet customization; preserve configurable sections and preferred-list startup.
- Trial a collapsed Completed group with an obvious reopen path. Preserve saved
  view intent, child relationships, shared order and completion/Done semantics;
  do not silently overwrite existing preferences to introduce a new default.
- Evaluate a transient Undo shortcut against an explicit reopen path before
  selecting its final behavior. Undo must use current versioned domain operations.

Selected implementation (October 24): Home uses a compact “Your day” heading,
separate 44px completion controls and task-title links into the existing detail
drawer. Capture requires an explicit destination and preserves the title across
list/section changes. Successful undated capture explains why Today stays unchanged
and offers Open list without clearing saved filters.

Recovery uses explicit Reopen in a session-only Recently completed area rather
than a timed Undo: it remains discoverable after the mutation finishes and avoids
a time limit. Only acknowledged completions enter recovery. Writes use existing
versioned, actor-bound task operations and exact-payload retries. Scalar completion
and creation read the current authorized list revision; multi-field drawer drafts
retain their original version so concurrent edits still conflict visibly.

The collapsed Completed group applies only to the existing all-completion view,
without saving a preference. Previously completed roots fold; newly completed rows
stay in place during that list visit for recovery. Parents with unfinished children
stay visible. Reopening preserves section/order and restores focus, with guidance
when a section/filter hides the restored row. Explicit completed-only/hidden views
retain their meaning. Detail/destination reads reject stale selection responses;
revoked/archived destinations disappear while capture text remains.

Gate: complete/reopen and capture from Home, account/access changes, cross-list
destination, filtered creation, exact retries, live refresh and return context.

### Phase 4 — shared management and recovery

Audit F07, F09; sharing/archive/error reviews.

- Separate List details, People and Only for me; show Shared and Owner/Editor
  cues. People is directly reachable without rebuilding a large list toolbar.
- One active People/settings surface; literal roles and in-app invitation scope.
  Separate pending/sent/failed states and preserve existing-account restrictions.
- Separate archive/delete management; direct owner Restore in archived banner;
  editors receive owner guidance. Explain leave/delete/shared/subtask consequences.
- Wuff error pages provide safe Back to lists/retry exits. Invalid OAuth requests
  restart from the client; inaccessible links reveal no private object existence.

Gate: owner/editor roles, invite/accept/decline/revoke/leave, archive/restore,
cancelled destruction, expired invitations, session/access loss and preserved
drafts. Recapture previously unsettled archive/Basic states.

### Phase 5 — reminders and integration readiness

Audit F08; reminder/GitHub/Cursor/settings reviews.

- Lead reminder setup with delivery status/device setup, then schedule preferences.
  Distinguish preference saved, permission granted, registered device and verified
  delivery. Use Save preference when delivery is unavailable; show timezone and
  quiet-hours adjustments. Provide loaded/error/retry states.
- Stage GitHub account → repository → sharing consent → optional automatic issue
  creation. Show destination/export scope and only applicable stop-sync controls.
- Show personal Cursor account/repository/environment/execution readiness and
  explicit paid-action wording; preserve the existing execution gate.

Gate: unavailable/ready/failed/uncertain cases with mocked providers; no paid run,
external publication or notification activation merely to prove the UI. Real
delivery and installed-device proof remain separately recorded release gates.

### Phase 6 — language, authentication and guide

Audit F10 and P2/P3 consistency/reference reviews.

- Use Saved views consistently; distinguish Save view and Save as new view.
- Literal action/permission/error labels; friendly supporting copy retains Waffles.
- Clear invited-account setup and password recovery, separate resend/change-email,
  password-manager/code paste support and specific form feedback.
- Compact guide navigation; palette experimentation in its design section; early
  kit/copy/template actions, component search/jump links and version provenance.
- Unify date draft/shortcuts/save/clear behavior across table, inline and details.

Gate: auth failure/expiry/paste/autofill, consistent scoped saves, guide reflow and
working links; update product/design guidance to match the implemented behavior.

## Verification and release contract

Use targeted browser scenarios and existing isolated-development fixtures, then
workspace/root typecheck, unit tests, optimized web/MCP/prototype and shared
native-frontend builds. Reuse existing permission/concurrency tests where domain
behavior is unchanged; add checks for new interaction behavior and recovery.

Measure 320/390px and desktop layout, long content, 200% text/400% page zoom,
target bounds, sticky actions and keyboard focus. Manually check VoiceOver/NVDA,
real phone keyboard and seven-palette contrast before claiming those properties.
Modal focus follows W3C APG; automated checks alone are insufficient.

Compare realistic tasks before/after with everyday-list, shared-editor and Work
users. Record completion without help, first action, wrong turns, recovery, task
time and perceived ease. The audit priorities are hypotheses, not participant
findings. Any observed data loss, accidental destructive/paid action or live
accessibility blocker takes precedence over phase order.

Record each phase in `docs/verification.md`, including source, commands, fixture
cleanup, screenshots and explicit untested boundaries. Production uses the
existing Vercel CLI workflow and a separate release smoke; installed clients and
named MCP hosts need their own evidence.

## Delivery status

| Phase | Status                               | Evidence                                                                    |
| ----- | ------------------------------------ | --------------------------------------------------------------------------- |
| 1     | Locally complete; production pending | [Phase 1 evidence](verification.md#ux-improvement-phase-1--october-24-2026) |
| 2     | Locally complete; production pending | [Phase 2 evidence](verification.md#ux-improvement-phase-2--october-24-2026) |
| 3     | Locally complete; production pending | [Phase 3 evidence](verification.md#ux-improvement-phase-3--october-24-2026) |
| 4 | Locally complete; production pending | [Phase 4 evidence](verification.md#ux-improvement-phase-4--october-24-2026) |
| 5–6 | Specified | Phase 5: reminders and integration readiness |
