# Personal list views

Updated: October 17, 2026

Each account has one saved view per accessible list. A view contains title/key search, section/status/priority/assignee filters, due-date filters, completion visibility, grouping by section/status/due date, manual/priority/due/updated sorting, optional section sort overrides, compact/detailed layout and collapsed groups. The website exposes these under **Your view**. Settings also work on archived lists; task writes remain prohibited there.

Views belong to the authenticated account, with an independent revision. They never update the shared list version, task positions, sections or another member's preferences. There are no owner defaults or cross-list named views. New views include completed tasks, group by section and use manual compact ordering. The explicit completion selector replaces the separate Completed bucket.

## Control presentation

The October 17 design refinement keeps explicit Apply/Reload/Reset semantics. Your view and Sorting per section have matching decorative chevrons with native details/summary behavior. The header is centered in a 44px track; expanded groups use 12px gaps. Web selects retain native selection with a 12px inset chevron and text clearance. See [refinement evidence](design-language.md#view-control-spacing-refinement). No view contract, version or persistence behavior changed.

## Contracts and projection

Authorized list snapshots include `personalView: { version, view }`. Its optional TypeScript property preserves compatibility with older local fixtures; current server snapshots always supply it. `GET /api/v1/lists/:id/view?today=YYYY-MM-DD` and MCP `get_list_view` return `{ list, groups }`. Callers must supply their local calendar day, so Today/Before today/After today remain calendar comparisons rather than server-time-zone guesses. The website uses its existing local-day clock. The embedded app calculates its local day when rendering; refresh the view after midnight to recompute relative filtering.

`PUT /api/v1/lists/:id/view` and MCP `update_list_view` accept `{ viewVersion, view, operationId }` (plus `listId` for MCP). This replaces the full view, with omitted fields reset to defaults. Use `list.personalView.version`, not the shared list version. Reads require `lists:read`; saves require `lists:manage`, consistent with personal sidebar ordering. No owner role is required. All adapters use the same domain services, admission and access checks. Website writes retain same-origin and account-switch guards. MCP now has 30 tools; existing clients need a catalog refresh.

Filter arrays use OR within a field and AND across fields. Empty arrays mean unrestricted; null section/assignee means unsectioned/unassigned. Website and embedded controls select one value per field; API/MCP callers can supply multiple values. Relative due-date filters include completed tasks unless completion visibility excludes them; “Before today” describes the date rather than implying unfinished work. Search matches title or key, case insensitively.

A root is shown if it matches all filters or any child matches all filters, inheriting the root's section for child matching. Contextual parents carry matching child IDs in `childMatches`, and both UIs explain their appearance. Subtasks stay attached, retain their own state and full context, and are not independently regrouped. A parent's own status/date determines its group even when only its child matches. Detailed rows summarize key/workflow/priority/assignment/link count; task pages retain full metadata.

Manual order uses persisted positions, then IDs. Priority sorts urgent first; updated sorts newest first. Due dates sort earliest first, missing dates last. Ties use manual positions and IDs. Date groups sort chronologically, undated last. Section sort overrides apply only when grouping by section. Computed sorting removes task drag handles, including child handles. Filtered manual reorder merges visible active roots into the complete active-root order, preserving hidden positions; completed roots remain un-draggable. Personal view and task revisions merge independently in the browser cache, preventing late task reads from restoring older preferences.

## Storage and concurrency

Drizzle migration `0008_thin_pyro.sql` adds `wuff_list_views` with `(user_id, list_id)` primary key, independent revision and JSON view. Both foreign keys cascade on deletion. No existing task/auth schema changes. Existing views are created lazily. Access revocation hides a retained preference row; rejoining the same list restores that account's saved view. Deleted lists remove it.

View writes use operation receipts and the existing list row lock to serialize concurrent first saves and access revocation. They do not increment the list revision. Stale view revisions return 409; identical operation retries apply once and reread current authorized data. Reusing an operation ID with different input returns an idempotency conflict. The website retains uncertain requests for exact retry; drafts expose remote revision conflicts instead of silently overwriting them. The embedded form retains its exact pending save on unknown outcomes.

The sealed live catalog joins only the actor's view revision. A view change invalidates that actor's sessions without exposing another user's view settings. Shared task changes still use the shared list revision. Existing polling/focus recovery remains active.

## Development verification

- Isolated development migration applied successfully, with generated SQL reviewed before application.
- `pnpm check` passed: TypeScript, 34 unit tests and optimized website/MCP App builds. Unit cases cover child context, combined filters, calendar-day changes, completion visibility, stable sorting, missing dates, section override scope and independent cache revisions.
- Focused synthetic database integration passed: member isolation, read-only scope denial, unchanged tasks/shared revision, identical retries, operation conflicts, competing saves, archived views and post-revocation read/retry denial.
- Synthetic browser saved search/due sorting/detailed layout. The official MCP Apps SDK host read the same preference, saved status grouping and collapsed a group; the already-open website received both changes live.
- Browser layout checks measured 390px and 320px document widths without overflow. Visible selects measured 44px high and 16px text at 390px. [Mobile screenshot](screenshots/personal-views-mobile.png) contains only synthetic data. These checks do not certify physical iPhone/Android behavior or every named MCP host.

The final isolated `pnpm test:integration` run passed all 21 tests in 225.7 seconds, including actual HTTP→MCP and MCP→HTTP view saves, explicit calendar-day validation and live view-revision delivery. An earlier run passed 19/21 while simultaneous manual browser polling hit managed-auth HTTP 429s in OAuth/invitation and Realtime tests. Closing the manual sessions and running the suite alone resolved both; no authentication cache or access checks were weakened. The final presentation-only save guard was subsequently typechecked and rebuilt.

The disposable development list/task was removed and confirmed inaccessible. Local browser fixture OAuth grants were revoked and verified inactive; browser tabs/viewport and local server were cleaned up. A scan of 25 generated browser/MCP App files found no configured server credentials or Postgres URLs.

## Production migration

Migration `0008_thin_pyro.sql` was applied through the existing production direct connection. Before/after hashes of every existing list, task and membership row matched; counts stayed at two lists, fifteen tasks and one membership. No auth-managed tables were changed. Deployment/browser evidence follows separately.

## Production release

Feature source `ab8258885fe96eab3c410f3cb0b43592cbe08ee5` passed GitHub run `39012834694`. The production smoke exposed a phone-only detailed-row grid placement issue. Follow-up source `0d15dccee5e316adc019969c713d32d9bc4c1c4e` makes metadata and child-match explanations span every grid column and removes an obsolete Completed-bucket hint. GitHub run `39013079468` passed for this source. Its final `pnpm check` passed all 34 unit tests, TypeScript and optimized builds; the browser credential scan passed again. The 21-case backend/HTTP/MCP integration run above remains applicable; this follow-up changes presentation only.

Deployment `dpl_7asfc7hFYEZraSPFaj1TyNLuod5B` is READY in `fra1` and was verified at the canonical production URL. An authenticated browser created a private disposable Work list/task, saved title search, status grouping, priority sorting, hidden completion and detailed layout, then collapsed a group. Reloading and reopening that list restored the saved choices and collapsed state. Detailed metadata measured 350px wide/24px high at a 390px viewport and 280px/24px at 320px; document widths matched both viewports. [Production screenshot](screenshots/personal-views-production.png) contains only the disposable fixture.

An independent authorized server read verified all saved preferences, personal view revision 3, unchanged shared revision 2 and one projected task. Cleanup deleted the disposable list and confirmed it inaccessible; its preference row cascaded away. Production returned to two lists, fifteen tasks and one membership. The browser tab was closed and viewport reset. Actual production Codex/ChatGPT catalog refresh and physical-device interaction remain client/user checks; local authenticated protocol and official SDK-host coverage are recorded above.
