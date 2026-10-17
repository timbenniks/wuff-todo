# Design language audit and proposed repair

Date: October 17, 2026. Historical audit and proposal. The subsequent [implementation and verification](design-language.md) records the delivered changes and expanded list-theme scope.

## Assessment

Wuff has a recognizable palette and companion, but lacks a consistent visual grammar for actions, information and layout. The problem is systemic: a transparent action, a due-date label, an editable heading and a destructive utility can receive almost identical emphasis. Large gaps coexist with crowded controls because spacing is assembled independently inside each feature.

Repair the shared primitives first, then apply them to the list and task-detail layouts. Keep the blue/slate identity, approved Waffles artwork, existing features, permission rules and explicit-save/conflict behavior. A new palette, font download, animation library or backend redesign would not solve these problems.

The accompanying [visual specimen](design-language-specimen.html) illustrates the proposal with synthetic content. It is a static review artifact, not working application functionality or a production screenshot.

## Evidence and scope

- Visually reviewed both user-supplied October 17 screenshots, including their annotated feedback. Screenshots establish appearance, not DOM dimensions, browser zoom or current deployment revision.
- Inspected current shared button/input components, global CSS, list shell/navigation, inline names, task groups/rows/subtasks, due-date controls, notes/editor, list settings, sharing/invitations, personal views, task detail/work metadata, sign-in/password setup, OAuth consent, connections and the MCP App source/build stylesheet.
- Read the implementation plan, specification, architecture, operating and verification guidance, and the earlier mobile usability review. That review's browser measurements are dated supporting evidence, not measurements rerun by this audit.
- Applied UI/UX Pro Max's full quick-reference audit categories and checked its platform scope. The skill's native checklist is not a web compliance standard. The frontend-design skill informed the visual specimen while preserving existing branding.
- No authenticated live application walkthrough, physical-device session, screen-reader test, network trace, performance benchmark or backend test was performed for this audit. State-dependent findings below distinguish source evidence from screenshot evidence.

## Priority findings

| Priority | Finding and evidence                                                                                                                                                                                                                                                                                                          | Proposed correction                                                                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **No primary-action hierarchy.** `components/ui/button.tsx` gives default and outline effectively the same white bordered treatment. Task-detail Complete uses ghost; settings and work-detail Save use icons. OAuth Allow and Cancel therefore have very similar weight.                                                     | Introduce explicit primary, secondary, quiet and danger roles. Label consequential and form-submit actions. One emphasized action per active task/form context.                                                                                   |
| P1       | **Statuses have no shared component or visual shape.** `DueDateBadge` is a small plain `time`; workflow/priority/assignment are plain text in WorkMetadata and one dotted sentence in detailed rows. Screenshot 1 places due status between two actions.                                                                      | Add non-interactive StatusTag and DueDateTag. Distinguish button boundaries and padding from tag shape/height; use icon plus text, no hover or pointer affordance. Group information separately from actions.                                     |
| P1       | **Task-detail header accumulates unrelated whitespace.** Navigation includes a 64px mascot and `mb-8`; key/copy uses a 44px button beside 12px text; title uses the generic h1 size; an always-rendered `min-h-6 mt-3` feedback paragraph precedes `my-5` actions.                                                            | Use explicit navigation, identity and action/status regions with parent-controlled gaps. Keep copy's hit area but align the small glyph beside the key. Put feedback in a defined local slot rather than reserving a blank line above actions.    |
| P1       | **Task alignment uses incompatible anchors.** Desktop TaskRow is `items-start`, completion is 24px plus `mt-1`, utility controls are often 32px, and due text adds another margin inside InlineName. Screenshot 2 exposes this vertical mismatch.                                                                             | Give the first row a shared alignment track: completion target, title and action rail centered on a 44px line. Put date/work metadata on a second track under the title. Row height grows naturally when metadata is present.                     |
| P1       | **Low-contrast utility affordances.** Several controls use `text-slate-400`; global task-panel CSS overrides some, but section delete, drag and heading pencil still use it.                                                                                                                                                  | Use a semantic icon token that passes the needed non-text contrast on white, page and each list tint. Muted must not mean disabled. See measured color pairs below; these are not a rendered-page certification.                                  |
| P1       | **Deletion is visually routine and recovery inconsistent.** List Delete is alongside Share/Settings. TaskRow deletes childless tasks directly but confirms cascading deletion; the previous mobile review records no Undo.                                                                                                    | Keep the previously requested direct task Delete control. Separate and label list Delete. Use one explicit confirmation pattern for irreversible task deletion; adding Undo would need a separate persistence/recovery design.                    |
| P2       | **List identity is fragmented.** `list-app.tsx` renders description outside the tinted header with `mb-8`; screenshot 2 correctly reads it as detached. Header actions are separate flex children and first-child basis changes with breakpoint.                                                                              | Put title, owner/type and description in one content region inside the tint. Give Share/Settings/Delete a single labeled action region that wraps below content at narrow widths.                                                                 |
| P2       | **List rhythm is an accumulation of blocks.** Header margin, description margin, Your view card, task count, projection count, No section heading, Tasks disclosure, rows, composer and section border each add spacing. The screenshot predates or omits some current controls; current source adds further vertical layers. | One compact view/count toolbar, followed by sections at a fixed rhythm. Merge section title/count/collapse into one header. Preserve group collapse and saved preferences. Show meaningful active-filter/sort context without repeated narration. |
| P2       | **Discoverability depends on icon recognition.** Desktop task rails contain six small utilities; phone action panels hide their existing text labels, even when open. Header actions rely on tooltip/accessible names.                                                                                                        | Visible labels for list management and expanded phone actions. Keep familiar task-row utilities compact and directly available as previously agreed. Do not add six labeled buttons to every row.                                                 |
| P2       | **One typography rule serves too many jobs.** InlineName assigns both list and task h1 `text-3xl sm:text-4xl`; date tags use 12px while adjacent buttons use 14px semibold. Headings/body use different system-font fallbacks.                                                                                                | Keep existing heading/body families for this pass. Define page-title, task-title, section-title, body, control and metadata roles with deliberate line heights. Components receive a role rather than infer size from HTML heading level.         |
| P2       | **Forms lose their visible actions.** Settings Save, work Save/Cancel and note/date controls often use check/X icons; capture fields rely on placeholders plus accessible labels. Personal-view search bypasses the shared Input.                                                                                             | Label Save changes / Cancel in full forms; retain compact icon Save/Cancel for inline rename. Provide a persistent New task label and visible Add action. Use the shared Input and field-error contract everywhere.                               |
| P2       | **Accessibility support is uneven.** InlineName links errors via `aria-describedby`, but password errors are general alerts; layout has no skip link. Sortable has keyboard support and a drag threshold, but no visible single-pointer non-drag reorder mechanism.                                                           | Keep working focus restoration and draft preservation. Add skip navigation, connected field errors and a labeled Move action offering existing order positions. Keyboard dragging alone does not satisfy the pointer alternative requirement.     |
| P2       | **MCP has the opposite action problem.** `scripts/build-mcp.mjs` colors every generic button solid blue, including many utilities. Its inline styles and date text duplicate web rules.                                                                                                                                       | Mirror semantic tokens and action/tag roles in the standalone MCP stylesheet and DOM helpers. Share values/contracts where useful; do not force a React rewrite just to unify appearance.                                                         |
| P2       | **Read-only, pending and selection semantics need one system.** Archive is described in banners and local text; busy often disables every button without identifying the initiating action. Settings use amber while task-detail errors use another local treatment.                                                          | Shared feedback patterns: pending at the initiating control, confirmation after authoritative success, explicit read-only banner, persistent actionable failure. Keep uncertain-write retry identity and stale drafts intact.                     |
| P3       | **Performance risk needs measurement, not speculative infrastructure.** The note editor is already loaded on demand and the mascot has dimensions; task-menu placement measures layout on scroll/resize. No fresh timing trace exists.                                                                                        | Preserve lazy loading and dimensioned artwork; profile menu scroll/resize before changing it. Do not introduce virtualization, caching, skeletons or motion libraries without evidence.                                                           |

P1 means address in the first visual repair; it is not a declaration of a production outage.

## Direct response to the screenshots

### Task detail

1. Navigation: back link and a restrained 40px companion on one 44px track; 16px to task identity.
2. Identity: key and copy target together, then 8px to the title. Cap task title at 32px desktop / 26px phone, with natural wrapping and no fixed height.
3. Information: show workflow and due-date tags together, 12px below the title. They are readable values, not clickable pills.
4. Actions: Complete task is a filled blue button; Change due date is a bordered secondary button. Put this row 16px below information, with 8px between buttons. On phones the collection wraps without shrinking labels.
5. Content: 24px from the action region to the first panel. Panels use 20px desktop / 16px phone padding, 12px heading-to-content gap and 16px between panels. Do not give a one-line note the padding profile of a long document.
6. Place pending/saved/error feedback beside the action/form it belongs to; retain a stable accessible status region without a vacant full-width spacer in the header. Avoid content jumps when feedback appears.

### List

1. Move the description into the tinted header beneath owner/type metadata. Keep ordinary text contrast; list tint communicates list identity, never workflow state.
2. Label Share, Settings and Delete list. Use secondary treatment for management controls and a separated quiet danger treatment for Delete list. Owner/editor visibility remains unchanged.
3. Use one count/view toolbar 16px below the header. Consolidate the multiple counts into a contextual result such as “2 of 5 tasks · Manual order” when filtering is active.
4. Make “No section · 1” or the named section/count the disclosure itself. Remove the extra generic Tasks row while keeping the same collapse behavior.
5. Align completion to the task title's first line. Date tags sit under the title in the same column; utilities align with that first line, not the combined title/metadata block.
6. Keep capture near its group: 12px after rows; 24px between sections. Use a visible New task label and an Add action. Preserve Enter submission and manual ordering.

## Proposed system contract

These are implementation targets, not measured current values or newly shipped behavior.

| Role              | Contract                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary action    | Blue `#315f9b`, white label, 44px minimum height, 14px/600 text, 8px radius; explicit verb. Hover/pressed/focus/disabled and saving variants. Examples: Add task, Save changes, Complete task, Sign in, Allow connection.                                  |
| Secondary action  | White/transparent surface, sufficiently visible outline, dark label; same control text and height. Examples: Change due date, Settings, Cancel when paired with primary Save.                                                                              |
| Quiet utility     | Transparent, 44px target for this product, 16–18px icon; semantic label and tooltip when icon-only. Visible text in expanded menus. Examples: Copy link, row Notes, rename.                                                                                |
| Danger            | Labeled and separated from normal management. Quiet danger for entry; filled danger for final irreversible confirmation. No red fill for every row Delete.                                                                                                 |
| Workflow tag      | Non-interactive, about 24–28px tall, 12px/600, compact icon/text, restrained tint; rounded rectangle distinct from controls. Todo neutral, In progress blue, In review violet, Blocked red, Done green. Pair foreground/background tokens and verify each. |
| Due tag           | Native `time` semantics, calendar icon and readable text; neutral future, blue today, red overdue, neutral completed. Never use an identical chip as both display and picker trigger.                                                                      |
| Priority/assignee | Quiet labeled metadata; emphasize high/urgent priority where relevant. Do not color every attribute or imply Unassigned is an error.                                                                                                                       |
| Type              | Page title 30/36; task title 32/40 desktop and 26/34 phone; section 18/24; body/task name 16/24; control 14/20; metadata/tag 12/18. All sizes in CSS px, responsive wrapping and zoom required.                                                            |
| Space             | 4, 8, 12, 16, 20, 24, 32, 40. Component owns internal padding; parent owns separation. No child margin used to compensate for sibling alignment.                                                                                                           |
| Width             | Desktop sidebar remains 260px. Main content uses a shared roughly 800px maximum inner measure and 24–32px gutters; phone gutters 16px. Verify the list/detail width relationship rather than blindly matching outer max-width classes.                     |
| Shape             | 8px controls, 6px tags, 12px panels, 16px identity header. Borders organize; shadows reserved for overlays.                                                                                                                                                |
| Motion            | Short color/opacity feedback only, respecting reduced motion. No celebratory/page-entry animation needed for this repair.                                                                                                                                  |

Retain `#f7fafc` page, white panel, `#263e55` ink and existing named list tints. Add semantic tokens for muted text, icon, control border, state foreground/background and feedback. Do not replace the brand with the generated teal/orange palette.

### Contrast and accessibility

Use 44×44 CSS px as Wuff's practical interaction target, including tablet widths. Do not claim 32px desktop controls automatically fail WCAG: [WCAG 2.2 target minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24×24 CSS px with specified exceptions. Assess actual clickable boxes, not glyph size.

Check essential icon/control affordances against [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), including each list tint. Add a single-pointer alternative to drag per [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html); retaining keyboard drag is valuable but insufficient by itself.

Source-token calculations isolate color pairs and do not account for every cascade, transparency, focus state or rendered surface. The palette's declared muted text is marginal on the page background; local Tailwind slate overrides must also be assessed independently.

| Source color pair                                      | Contrast       | Implication                                                                  |
| ------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------- |
| Primary `#315f9b` / white                              | 6.48:1         | Suitable text pair for the proposed primary button.                          |
| Declared muted `#61768b` / white                       | 4.70:1         | Passes normal text threshold on panels.                                      |
| Declared muted `#61768b` / page `#f7fafc`              | 4.48:1         | Below 4.5:1; use a darker semantic muted token.                              |
| Slate-400 `#94a3b8` / white, page                      | 2.56:1, 2.45:1 | Too weak for essential icon information requiring 3:1.                       |
| Current checkbox `#aabdcf` / white, page               | 1.93:1, 1.84:1 | Boundary needs strengthening where it identifies the completion control.     |
| Proposed muted/icon `#536c82` / white, page            | 5.48:1, 5.22:1 | Provides stronger secondary text and utility contrast.                       |
| Specimen control boundary `#708499` / header `#e7f0f8` | 3.34:1         | Passes 3:1 on this specimen tint; all other named list tints remain to test. |

## Screen coverage and acceptance

| Surface                                 | Repair / acceptance focus                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lists, sidebar, archive and invitations | Labeled management, coherent header, visible capture, selected navigation, compact count/view context, archive/read-only and invitation pending states.              |
| Compact/detailed tasks and subtasks     | Shared first-line alignment; clear completion versus workflow; date/progress cues; long-title access; direct Delete/drag preserved; labeled phone panel actions.     |
| Task detail and work metadata           | Tight identity group, primary completion, separate status band, consistent panels, readable reference links and deliberate empty states.                             |
| Inline rename                           | Keep Enter/Escape and single-line phone editor; stable field width and 44px Save/Cancel targets; visible error and restored focus.                                   |
| Notes and images                        | Consistent editor toolbar/button hierarchy; labeled Save/Cancel; preserve upload/draft states, source fallback and private delivery.                                 |
| Date, settings, sharing and views       | Shared form footer and feedback; readable field labels; same control tokens; no draft loss on remote refresh.                                                        |
| Sign-in and password setup              | Clear filled submit, quiet recovery link, connected errors, pending label, password-manager/paste support.                                                           |
| OAuth consent and connections           | Allow visibly primary, Cancel secondary, Disconnect consequence clear; loading/failure with a recovery action.                                                       |
| Embedded MCP App                        | Equivalent action/status grammar at host widths; responsive text/control reflow, explicit save and accessible states. Host/theme rendering needs its own validation. |

## Execution sequence

1. **Foundation and specimen:** implement semantic Button roles, tag components, field/feedback patterns and type/space tokens. Inventory each call site explicitly; changing Button's default globally would otherwise turn every existing default into an unintended primary. Update the product specification's blanket preference for quiet controls to distinguish utility icons from primary actions. This audit is the proposal for that refinement; it does not silently rewrite the confirmed specification.
2. **Screenshot repair:** apply the agreed system to list identity/management, section headers, row alignment/capture and task-detail layout. Keep compact/detailed views, personal grouping/sorts, completion and draft behavior intact. Avoid nesting button/link targets inside whole-row links.
3. **Complete the language:** apply the same roles to editing, notes, dates, sharing, settings, views, auth, OAuth, connections and MCP. Add the non-drag reorder alternative using the existing authorized reorder operations. Any recovery mechanism requiring new persistence remains separately scoped.
4. **Verify and release:** inspect synthetic browser states, run the relevant checks, document actual results and release through the existing workflow. A visual build is not production or named-client proof.

No schema or permission change is expected for the visual repair. No new feature integration, broader themes, native app or offline queue is included.

## Verification gate for implementation

- Test 320, 390, 640, 768, 1024 and 1440px; include tablet touch, short landscape viewport, 200% zoom and long task/section names. Reflow at a 320 CSS px viewport without document overflow.
- At each width inspect empty, populated, filtered/no-match, collapsed, completed, archived, editor-member, loading, saving, failed, uncertain-retry and remote-conflict states. Check tall notes, children and all workflow/date tones.
- Verify the first-line center alignment numerically: completion target/title/action track within 2 CSS px of their intended centers. Metadata aligns to the title column. Measure actual control targets and spacing after rendering.
- Confirm tags are absent from the tab order; controls have accurate names and state; keyboard focus remains visible and returns after editing/dialog dismissal. Test screen-reader output for errors and a single meaningful save announcement.
- Check task completion/reopening, inline Enter/Escape, notes/date Save/Cancel, private images, view persistence, pointer/keyboard/non-drag ordering and retained drafts through live updates. Keep operation IDs, versions and owner-only controls intact.
- Run workspace typecheck, existing meaningful tests and builds appropriate to changed surfaces, including MCP bundle. Do not add tests that only snapshot chosen Tailwind classes.
- Capture paired screenshots using identical fixture/viewport/zoom, inspect contrast in composed UI, and distinguish local browser proof from production, named MCP host and physical-phone evidence.

## Skill search record and applicability

Supporting root supplied by `npx skills use`: `/var/folders/57/xngmjvn55szbmm57lp4qb_ch0000gn/T/skills-use-IJuQzM/ui-ux-pro-max`. References were resolved there.

- `personal task manager warm compact --design-system`: Flat Design is broadly relevant, but Product Demo + Features is a marketing pattern; Caveat/Quicksand and teal/orange do not fit the established task UI. Rejected as a product-wide prescription.
- Narrower retry `productivity dashboard task management --design-system`: again returns the marketing pattern; Plus Jakarta Sans is plausible but no font change is needed. No verified product-wide design-system match was found; none was persisted as MASTER.md.
- `button action status distinction --domain ux`: navigation result is off-topic; submit feedback and contextual status updates are relevant only to feedback. Retry `primary action --domain ux` returned zero. Action hierarchy recommendations therefore use the skill's built-in quick-reference rules (primary-action, state-clarity, visual-hierarchy, compact-label-overflow), not a claimed database match.
- `responsive component consistent spacing --stack nextjs`: image/error/cache results do not fit layout. Retry `component --stack nextjs` returned zero. No framework-specific recommendation from these searches was applied. Spacing/reflow recommendations come from the built-in rules and inspected code.
- Reviewed all ten quick-reference categories. Charts are not applicable. Native safe-area/Dynamic Type instructions and offline/autosave suggestions do not override this web project's explicit scope and save contracts.

## Audit verification record

Application code, dependencies and runtime behavior are unchanged. The audit deliverables are this report and the static specimen.

- Rendered the specimen in headless system Chrome at 320, 390, 640, 768, 1024 and 1440 CSS px widths. Document width equaled viewport width at each size; both mascot images loaded. All displayed specimen buttons measured at least 44×44 CSS px after correcting an initial 40px phone utility override.
- Visually inspected the saved [desktop specimen](screenshots/design-proposal-1440.png) and [phone specimen](screenshots/design-proposal-390.png). These demonstrate the proposal only; synthetic tasks do not touch a database. Phone truncation and direct Delete/drag remain visible tradeoffs to validate in the working app.
- Calculated source and specimen sRGB contrast pairs directly using relative luminance. These findings concern the specified pairs, not a complete rendered-app conformance result.
- `git diff --check` passed. Application tests/builds were not rerun because the deliverables are documentation and an isolated static HTML specimen. No deployment occurred.
