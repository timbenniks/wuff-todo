# Todo UX maturity proposal

> October 31 follow-up: Tim’s [focused productivity redesign](todo-productivity-redesign.md) supersedes this iteration’s list-first Overview and expandable Favorites presentation. Historical evidence below remains scoped to the earlier implementation.

October 31, 2026. Approved for implementation; draft PR #45 on `codex/todo-ux-maturity`. Local implementation and verification are recorded below; production release is separate.

## Outcome

Make Todo easy to enter, scan and navigate on a laptop: lists occupy the primary
overview canvas, hierarchy remains stable when favoriting, and a parent page
visibly connects to its child lists. Keep Wuff's DM Sans, palettes, shared controls,
44px interaction targets and concise language.

This implementation follows the current web/PWA/HTTP/MCP decision. It complements
the October 24 UX programme and replaces its Today-first overview priority and
the favorites contract's single-appearance rule with Tim's approved list-first
overview and canonical hierarchy. Related feature contracts are updated below.

## Evidence and limits

- Reviewed the supplied sidebar screenshot, repository source at `d8d4b36`, current
  implementation/product/architecture documents, module/surface/design guides and
  existing nesting/dashboard tests.
- Read-only live MCP `list_lists` and `get_list_order` confirm that the linked
  Cosmic Breakfast master plan is top level and has seven direct child lists.
  It is not nested under Wuff Todo. The catalog also contains a separate top-level
  Cosmic Breakfast list; do not merge or rename either automatically.
- `packages/contracts/src/modules/todo/index.ts`, `sidebarGroups`, removes active
  favorites before resolving visible parents. A favorite parent's unstarred
  children consequently become roots. This is documented and explicitly tested
  behavior, rather than evidence of lost nesting data.
- `packages/ui/src/modules/todo/app/lists/sidebar-lists.tsx` renders favorites as
  flat shortcuts with no child controls. Parent rows in the main tree alone get
  an additional leading icon button; their titles shift right compared with other
  roots. This explains the misleading hierarchy visible in the screenshot.
- `packages/ui/src/modules/todo/views.css` uses a 260px default desktop sidebar.
  Repeated list icons, drag controls, parent controls and shared indicators consume
  substantial title space. Favorite rows additionally reserve 58px right padding.
- `home-dashboard.tsx` renders Today, Upcoming and Favorites. Its `lists` input
  already supplies the authorized catalog, but the main canvas lacks an all-lists
  browser. Undated, nonfavorite lists have no overview representation.
- The selected-list page in `list-app.tsx` has no child-list navigation near its
  heading. The existing contract intentionally shows only the parent's own tasks.
- Live browser inspection was blocked by the browser runtime's missing service
  module. No fresh viewport measurements, keyboard checks, screen-reader checks,
  usability study or production write was performed. This is a focused review of
  Todo discovery/navigation, not a fresh audit of every Todo workflow.

## Research translated into Wuff decisions

These sources establish patterns, not proof that a specific Wuff layout will work.

| Reference                                                                                                                         | Relevant pattern                                                        | Recommendation for Wuff                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Todoist favorites](https://www.todoist.com/help/todoist/features/add-a-project-label-or-filter-to-favorites-in-todoist-zezDfvSK) | Dedicated shortcuts; favorite order follows source order                | Keep shortcuts tied to the existing personal order; make favoriting visibly separate from moving a list.                                                                           |
| [Todoist sub-projects](https://www.todoist.com/help/todoist/features/create-a-sub-project-in-todoist-aTA15C70)                    | Explicit indented project hierarchy                                     | Reserve identical columns for all roots, indent children consistently, and expose parent context. Wuff keeps its existing one-level model.                                         |
| [Microsoft To Do list organization](https://support.microsoft.com/en-us/todo/organize-your-lists)                                 | Groups organize independent lists; removing a group preserves its lists | Communicate organization independently of content/permissions. Wuff parents remain real lists with their own tasks.                                                                |
| [W3C disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)                  | Nested semantic lists and separate disclosure controls                  | Use links plus labeled expand buttons, visible keyboard focus and nested list semantics. A full ARIA tree widget is unnecessary unless its complete keyboard model is implemented. |
| [W3C window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)                                                   | Named, focusable separator with size state and keyboard resizing        | Offer pointer and keyboard resize, bounds and a reset. The APG pattern notes incomplete example/review work; validate the implementation with assistive technology.                |

## 1. Make the Todo overview list-first

Start `/lists?home=1` with a compact Todo heading, **Your lists**, a visible
**New list** action and **Find a list** field. Put Today and Upcoming below the
list browser, respecting their existing visibility/order preferences within that
secondary area. Keep explicit overview URLs and last-list startup behavior.

Display every active root as a compact tile or row with its complete wrapping
title, small palette marker, favorite action, explicit Shared status where relevant
and child-list count. Parents expose child links in the canvas, in saved sibling
order, rather than scattering children into unrelated cards. Favoriting should
not reorder this canonical catalog. Do not require dates or favorites for a list
to appear. For larger catalogs, use compact rows and search rather than ever
larger decorative cards.

Search matches list titles across roots and children. A matching child retains
its accessible parent context and is revealed even if the group was collapsed.
Clearing search restores the prior expansion state. Distinguish no lists, no
search matches, loading and failed catalog reads; failures offer Retry.

Initial scope uses existing catalog data. Task totals, rollups, progress bars and
"recently used" ordering are deliberately deferred: catalog summaries do not
currently supply these metrics, and loading every list's tasks would add avoidable
latency and data exposure. List titles, sharing, favorite and child counts suffice.

Acceptance: an undated, nonfavorite list is visible in the first content region;
all active lists are reachable in the main canvas; finding a child preserves its
parent; the page remains useful with all dated-task sections hidden.

## 2. Preserve hierarchy and simplify the sidebar

Use the labels **Overview**, **Favorites**, **Your lists**, **Archive**, and
**Settings**. Keep Waffles and warmth in the identity while navigation stays literal.

The complete tree always includes favorite lists in their original positions.
Favorites are additional shortcuts, deliberately referencing the same lists rather
than relocating them. A favorite parent can expand to its children using the same
authorized hierarchy; a favorite child shows a small parent-context label. A child
shown through a favorite parent is not itself implicitly favorited. Both regions
share current selection and saved parent collapse state; opening a child reveals
its parent. Favorite shortcuts have no separate drag ordering in this slice.

Use a stable row grid: disclosure slot, small color marker, flexible title, quiet
trailing utilities. Every root reserves the disclosure slot, including leaf lists.
Only actual children receive indentation and a subtle connecting guide. Preserve
user-authored emoji; remove the redundant checklist icon on every row and the
repeated star icon within the already-labeled Favorites region.

Keep Shared cues and selected state understandable without color alone. Make
reorder affordances quieter on pointer devices, reveal them on focus as well as
hover, and retain a touch-accessible action and non-drag position picker. Retain
44px targets. Titles get most of the row width, with full text available on focus
or explicit title disclosure; phone navigation continues wrapping full names.

Acceptance: root title columns align whether or not they have children; starring
or unstarring a parent/child never changes its displayed canonical parent; archive,
deletion and revoked-parent fallback still work; reorder operates on unique IDs
in the canonical sibling groups despite additional shortcut references.

## 3. Add a resizable, remembered desktop sidebar

Prototype a 320px default with a 260–440px range. Treat these as starting values,
not measurements established by this review. Clamp against the available viewport
and a usable main canvas, and switch to the existing Lists sheet when both panes
cannot fit. Do not apply a saved desktop width to the phone sheet.

The divider supports pointer dragging, keyboard Left/Right adjustment, accessible
name/value/bounds, and an explicit Reset width action. Test pointer cancellation,
zoom and window resizing. Never let dragging select page text or compete with
list reordering.

Remember only a numeric width in an account-specific, versioned localStorage key
such as `wuff:todo:sidebar-width:v1:<userId>`. Validate finite numbers, clamp on
read/resize, catch storage exceptions and fall back gracefully. Save on committed
resize rather than every pointer event. Avoid a hydration jump where practical.
This is device layout state, following the existing device-local last-list
precedent; it stores no list contents and creates no synced account preference.

Acceptance: reload restores the width; changing account cannot inherit another
account's setting; malformed/blocked storage does not break navigation; a saved
wide width remains safe after shrinking the window; keyboard users can resize and
reset without dragging.

## 4. Make parent and child pages explain their relationship

On a parent page, place **Child lists (7)** immediately below the title/description
and before its task controls. Use compact wrapping links/rows in saved order,
with shared status per child. Desktop shows the links directly; phones show a
compact preview with a clearly labeled **Show all 7** expansion so tasks remain
close to the header. Keep the parent's own tasks under **Tasks in this list**.

On a child page, show an accessible breadcrumb back to its parent and a compact
sibling switcher. Deep links, Back/Forward, saved filters and unsaved task drafts
retain their existing behavior. Parent navigation derives from the current actor's
catalog, never from another member's organization. If the parent becomes
inaccessible or archived, remove its link/context and apply existing promotion
rules; never expose an inaccessible name.

Offer **Move list** and **Add to favorites** through a concise row/page action
menu, reusing the existing Your sidebar operations. Put **New child list** in the
later management slice: creation plus personal placement currently require two
mutations, so define partial-success/retry recovery before introducing a one-step
promise. Do not automatically share children or aggregate their tasks into the
parent.

Acceptance: opening the linked master plan makes its seven children discoverable
without opening navigation; a child leads back to its actual parent; another
member sees only their own organization and authorized lists.

## Delivery order and surface contract

| Slice                          | Reviewable result                                                           | HTTP/MCP and connection implications                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: hierarchy and sidebar       | Canonical tree, contextual favorites, aligned rows, quieter icons, resize   | Reuse `listLists`, `getListOrder`/`reorderLists`; `/api/v1/lists`, `/api/v1/list-order`; `list_lists`, `get_list_order`, `reorder_lists`. Update shared projection and embedded `show_lists` together. Width is browser-local layout state.                                         |
| B: overview                    | Your lists first, title search, child navigation, dated panels below        | Existing authorized catalog and dashboard reads suffice. Keep synced dashboard settings unchanged; make Your lists a structural section initially. Extend `show_dashboard` with list browsing and retain tool-only catalog discovery. Do not silently alter Empire's portal widget. |
| C: list context and management | Child navigation, breadcrumbs, sibling switcher and direct personal actions | Reuse authorized catalog plus `get_list` and existing personal-order mutations. Extend `show_list` context where the host supports it. Design composite child creation separately before implementation.                                                                            |
| D: usability refinement        | Adjust geometry, labels and density from observed laptop/phone use          | No new persistence by default. Any later metric, preference or mutation gets shared contracts/domain/API/MCP coverage before delivery.                                                                                                                                              |

No new database schema, OAuth scope, consent expansion, provider connection or
paid execution is proposed for A–C. Read-only grants remain read-only. Existing
scope ceilings, tool selections, revoked connections, membership and operation
receipts remain authoritative. Older payloads omitting nesting/favorite fields
must preserve stored state. A shared parent never grants access to children.

Implementation follows the contributor skill/workflow: a `codex/` branch and early
draft PR, current feature brief, actual verification and fix/review loop. Update
nesting/favorites/Home/desktop contracts, product spec and relevant guide text as
each behavior is adopted. No production write, migration, release or merge is
authorized by this planning document.

## Verification and usability gates

Extend `tests/list-nesting.test.ts` with regressions for starred parents and
children retaining canonical hierarchy, contextual favorite expansion, archived or
inaccessible parents, sibling order and unique reorder payloads. Replace the old
single-appearance expectation explicitly as a changed product contract; retain
its reachability, saved-parent and archive assertions under the new behavior.

Add meaningful tests for list-search parent context/clearing, width parsing and
clamping, blocked storage/account separation, and stale/revoked catalog context.
Do not test icon names, static strings or CSS classes as behavior proof.

Use synthetic isolated data for API/MCP writes and browser interaction. Exercise
personal nesting/favorites API-write → MCP-read and MCP-write → web/API-read,
stale versions, concurrent edits, exact retries and replay after revocation using
the existing nesting/favorites integration suites. Exercise actual embedded
catalog/dashboard/list controls and tool-only fallback; local SDK evidence and a
named host's behavior are separate claims.

Before implementation handoff, run `pnpm typecheck`, `pnpm test`, appropriate
integration/browser checks and applicable build checks. Record commands, test
files/cases and results in the PR. Keep it draft while required checks are blocked.

Browser acceptance covers 320/390px phones, 1024px, 1280×800, 1366×768 and
1440×900 laptops, long titles/emoji, 200% zoom, keyboard/focus, screen-reader
hierarchy, scrolling and visible footer controls. Verify width restoration and
focus after navigation/resize, and preserve drafts during live refresh and access
loss. No horizontal document overflow or overlapping controls.

Run a short task-based review with Tim and another account: find an undated list,
explain Cosmic's parentage, favorite the parent and find a child, open a sibling
from its page, resize/reload, then recover a failed read. Proposed usability
targets: correct hierarchy interpretation on first attempt, one-click root access
from Overview, and no task requiring a tooltip to identify its list. Revise the
layout from observed failures before calling the UX mature.

Planning verification: source/document inspection and read-only live MCP catalog
and order reads only. Product tests/builds were not run for this proposal.

## Implementation record

The approved A–C slices are implemented in Todo shared UI and MCP rendering.
The canonical tree and favorites reuse current personal order services; overview
search and page context use shared pure projections. A compact List actions menu
adds direct favorite and explicit parent/move controls while retaining the existing
settings controls. Composite New child list remains deferred as planned.

`show_list`/`get_list` and `show_dashboard`/`get_dashboard` additionally return the
current authorized catalog, allowing contextual navigation without depending on a
separately enabled catalog tool or another account's cached catalog. No existing
fields/tools/routes are removed. HTTP continues exposing the same catalog through
`GET /api/v1/lists`. Mutation behavior and OAuth grants remain unchanged.

No dependency, schema, provider, consent, global safeguard or production
configuration change. Todo-scoped shared CSS changes use existing tokens. Existing
unrelated package/workspace/lockfile edits are excluded from feature commits.

The browser connector failed to load its service module. Rendered behavior is
verified using the repository's Playwright harness against the optimized local
application and actual MCP Apps SDK host, with isolated synthetic accounts.
Verification against optimized application source `9acccc9`:

- `pnpm typecheck`: passed all packages, web and root scripts/tests.
- `pnpm test`: 195 passed, no failures/skips. `tests/list-nesting.test.ts` changes
  the favorite projection expectation while retaining saved-parent/archive checks.
  `tests/todo-navigation.test.ts` covers search/context, missing/archived parents,
  width boundaries and invalid/blocked storage, account keys/reset, fresh MCP
  mutation catalogs, revoked-parent exclusion and scope/read-failure boundaries.
- A controlled rollback of the original favorite filter made two relevant tests
  fail; restoring the fix passed. No test/CI settings or safeguards changed.
- `pnpm preview:local`: optimized guide/MCP/web build passed and serves on
  `http://localhost:3000`. No deployment command was run.
- `node --env-file=.env.local --import tsx scripts/verify-todo-navigation.ts`:
  passed with no page errors. Exercises all six widths listed above, search and
  collapse restoration, all-hidden day panels with the catalog retained, aligned
  roots, favorites/children, pointer/keyboard width and reload/window clamping,
  reset, direct move out/back, parent/child/sibling/Back, lost committed favorite
  response with an identical retry, catalog failure/retry and isolated detail-503
  recovery. Actual MCP Apps SDK host checks list-first Home, search, catalog,
  favorites and parent/child/sibling navigation, including retained context after
  real task mutations on parent and child lists.
- Final adapter suite runs the new `tests/todo-navigation.integration.test.ts`
  with existing nesting/favorites integration suites, serially on synthetic users.
  It verifies actual HTTP-write/MCP-read and MCP-write/HTTP-read, read-only scope
  denial, unrelated private-list exclusion, sharing/revocation, fresh navigation
  in read/mutation replies, and revoked-connection rejection. Results are recorded
  in [verification](verification.md#todo-navigation-maturity--october-31-2026).
- First Codex review found two valid recovery defects: mutation replies lost MCP
  navigation, and detail-read failures hid successful catalog reads. Both were
  fixed in `9acccc9` with unit/adapter/SDK/browser regressions. Fresh review of that
  commit completed with no findings; [review summary](https://github.com/timbenniks/wuff-todo/pull/45#issuecomment-6542553561).

Visual refinements from browser inspection: overview groups start compact to keep
other roots above the fold; search reveals matching children without altering
expansion state. Desktop parent pages show all child links, while phones use a
three-link preview and expansion. Resize positioning is desktop-only to avoid the
Empire mobile header offset. Selected sidebar rows scroll into view. Uncertain
organization saves have a main-canvas retry as well as the sidebar retry.

Local browser/SDK verification does not establish physical touch-device,
screen-reader, 200% browser zoom, production or named ChatGPT-host behavior.
A task-based review by Tim/another person remains a usability acceptance step.
The PR stays draft for that review; no merge or production release was performed.

Representative synthetic screenshots from the final local browser run:
[Overview on laptop](screenshots/todo-ux-overview-laptop.png),
[Overview on phone](screenshots/todo-ux-overview-phone.png),
[parent list on laptop](screenshots/todo-ux-parent-laptop.png).
The full generated capture set and machine-readable outcome remain local under
`artifacts/todo-navigation/`; only these representative images are tracked.
