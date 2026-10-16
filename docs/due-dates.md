# Due dates

Updated: October 16, 2026

## Confirmed scope

Optional due dates on tasks and subtasks, before mobile planning. Web and embedded MCP App support Today, Tomorrow, a native calendar-date picker, setting/changing and explicit clearing. Date badges distinguish future, due today and overdue work. Existing manual order remains authoritative. Reminders, times, recurrence and calendar integrations remain later scope.

Each task has its own date. Parents and subtasks neither inherit nor cascade dates; changing completion or sections preserves dates. Completing a task keeps its date but removes overdue/today urgency styling. Archived lists retain dates with task writes denied by the same domain boundary as other edits.

## Calendar semantics

`dueDate` is a nullable `YYYY-MM-DD` calendar string, not a timestamp. It accepts actual Gregorian dates from `0001-01-01` through `9999-12-31`, including valid leap days. Invalid dates, year zero, relative words and timestamps are rejected before mutation. An omitted field preserves the existing value on update; explicit null clears it. Creation defaults to null. PostgreSQL `date`, Drizzle string mode and a range check preserve this contract without date-to-timestamp conversion.

A stored date never changes across time zones. Today/Tomorrow and overdue status use the viewer's current local calendar day; shared users in different time zones can cross midnight at different moments while seeing the same stored date. Quick choices follow calendar days, including daylight-saving changes. This milestone adds no account time-zone setting or backend natural-language date parser. MCP clients resolve relative dates in the user's calendar and send the explicit date.

The shared formatter uses English date labels and explicit UTC formatting of the calendar components, keeping server and first client render identical. Relative web status begins after hydration, then refreshes every 30 seconds, on focus and on visibility changes. MCP badge refresh updates only the badge DOM, preserving open editors. No full-list rerender or network call is needed merely to update a day label.

## Interaction and drafts

The web calendar action sits with the task's existing controls and opens an inline date panel. Set dates appear under the name, with a clear overdue label and color rather than color alone. Today and Tomorrow save directly; a custom date uses Save date. Clear date is explicit. Buttons, date fields, accessible names and focus return retain the existing task-control conventions and Waffles' voice.

Opening, toggling or receiving live updates does not save a date. A custom pick stays in memory through remote updates and parent movement into Completed. A changed remote date is shown alongside the retained pick, with an explicit Save my date action. Stale list versions are rejected if a race occurs after the last read. Uncertain website writes use the existing original-request retry controls. MCP date writes retain their operation UUID and original request for a safe retry. Cancel discards the draft; server-confirmed dates remain authoritative. No persistent/offline draft storage is added.

## Shared services and deployment

The existing task snapshot gains `dueDate: string | null`. HTTP create/update routes and MCP `create_task`/`update_task` accept the same optional nullable field. Admission, current owner/editor membership, `tasks:write`, active-list checks, list locking/versioning, operation receipts and live invalidation apply unchanged. No new routes, scopes or tools are required; refresh MCP tool catalogs to discover the field and its calendar semantics. Structured JSON remains data, without extra success chatter.

Additive Drizzle migration `0006_bored_valkyrie.sql` adds the nullable date column and valid-range check. Test on the existing isolated development branch, then apply on production using a direct connection before deploying the new snapshot reader. Existing task records remain unchanged and auth-managed tables are untouched. Both branches stay in the existing Vercel-managed Neon project.

Sources: [Drizzle PostgreSQL date string mode](https://orm.drizzle.team/docs/column-types), [Zod ISO date validation](https://zod.dev/api#iso-dates).

## Verification

Release evidence will be recorded here after checks complete. Named AI hosts and physical mobile devices remain separate from local protocol/SDK-host and responsive-browser proof.

- Final `pnpm check` passed after the date-picker input fix: workspace/root TypeScript, all 25 unit tests, and optimized Next.js/MCP App builds. Static scanning of 20 browser scripts found no environment secrets or domain SQL.
- Unit evidence covers real/invalid/leap dates, bounds, omission versus null, date-only update validation, tomorrow/today/overdue transitions, completed neutrality, year rollover, fixed-date formatting across three time zones, and calendar-day choices across DST.
- All 19 distinct development integration cases passed across the full run and a targeted rerun. The initial run passed 18/19; an existing private-image stream case failed once with a disturbed/locked response body, then passed unchanged on an isolated rerun. Its cause was not established; no image implementation was changed for this milestone. The due-date domain and authenticated HTTP/MCP cases passed in the full run.
- New domain evidence includes independent parent/child dates, update omission and explicit clearing, retained notes/order/completion, membership and read-only scope checks, cross-list rejection, invalid dates not advancing list versions, the database range guard, identical/changed retries, concurrent stale writes, archived writes, and revoked-access receipt replay. HTTP/MCP checks add date-bearing create/update snapshots, clearing from both adapters, invalid web dates and live list-version delivery.
- On the optimized local build, a synthetic account exercised Today/Tomorrow, custom date save, clearing, today/tomorrow/overdue badges and neutral completed dates. The calendar field now captures native input/change events and submits its actual form value; a custom pick survived close/reopen, a live MCP date change and parent completion/reopening. A stale MCP App date save displayed the conflict, retained the original pick and saved that pick on an explicit retry. Web and MCP clearing were both exercised. A separate domain read verified the final exact dates and unchanged completion states.
- The responsive picker measured `innerWidth = scrollWidth = 390`. Screenshots: [web](screenshots/due-dates-web.jpg), [phone-width picker](screenshots/due-dates-mobile.jpg), [MCP retained conflict](screenshots/due-dates-mcp-conflict.jpg). MCP App proof uses the official SDK host in an `allow-scripts` sandbox, not a named AI client's renderer. Physical-device and screen-reader certification were not performed.
- The additive migration passed on isolated development and then production using direct connections. Hashes of existing production task records, excluding the new nullable column, matched before/after migration. No auth-managed tables were changed. Temporary development lists were removed, synthetic browser/integration grants verified revoked, the original baseline fixture preserved, and the local dev server restored.
