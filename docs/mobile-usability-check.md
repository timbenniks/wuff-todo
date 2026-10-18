# Mobile website usability check

Date: October 17, 2026

October 18 follow-up: [the pre-mobile checkpoint](pre-mobile-checkpoint.md) records visible notes/progress/sync cues, full-title navigation, new phone target measurements and the required physical-phone checks. Its confirmed online-only/native scope supersedes the earlier planning wording below.

## Scope and result

Reviewed the current website before React Native/Expo planning. The starting checkout was clean. This check changes documentation only; it does not redesign the agreed single-line rows, remove direct Delete/drag controls, implement native apps, or change the online/offline boundary.

The core flows exercised in a responsive Chrome browser work. Native planning should carry forward the working permissions, explicit saves and conflict contracts, while resolving the usability decisions below. This is local development evidence, not a fresh production or physical-device sign-off.

## Follow-up after the design release

The findings below are the earlier audit, not the current implementation state. The [design release](design-language.md) adds confirmation for all task deletion, restores authorized selected-list context on reload/Back, labels expanded phone actions and offers click-to-position reordering. No Undo was introduced. Narrow single-line title capacity and quiet web notes/progress cues remain follow-ups. DM Sans and the view-control spacing refinements have their own newer screenshots and local measurements; physical-device checks remain outstanding.

## Findings, in priority order (historical)

| Priority | Finding and evidence                                                                                                                                                                                                                                                               | Recommended follow-up                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | A task without children deletes immediately. Source inspection of `task-row.tsx` shows confirmation only when children exist; there is no Undo in that flow. The direct phone Delete button is next to More and drag. No deletion was triggered in the browser during this review. | Decide accidental-delete recovery before copying this interaction into native apps. Preserve the requested direct control; assess confirmation or a separately scoped reversible-delete design. |
| Medium   | Reload loses the current list. After selecting the second synthetic list and reloading `/lists`, the first list was shown. Returning through navigation revealed the saved task and date. `selectedId` is component state initialized from the server's initial list.              | Preserve an authorized list reference in navigation so reload/Back can restore context. This needs no offline task storage; reads must still enforce access.                                    |
| Medium   | Single-line names have little room on small phones. The name region measured 108px at 320px and 178px at 390px, before any date indicator consumes part of it. “Pick up groceries” visibly truncates at 320px. More reveals the full name.                                         | Retain the user's single-line/direct-control decision. Treat full-title reading as an explicit usability requirement in any later refinement or native design.                                  |
| Medium   | Existing notes and collapsed subtask progress are hidden behind More on phones. After reload, the task with saved notes and a child looked like an ordinary row apart from its date. More exposes “Edit notes” and 0/1 progress.                                                   | Assess a quiet visible content/progress cue without adding another action rail or assuming hover tooltips work on touch.                                                                        |

These priorities are review judgments, not newly approved product requirements. No fixes were implemented during the check.

## Current browser evidence

Used the documented loopback browser fixture and a real synthetic development session on the existing isolated branch. Selected the fixture-created second “Weekend things” list; the pre-existing baseline list was left untouched.

- At 320×568 and 390×844, document width equalled viewport width. Additional checks at 640×800 and 1280×900 also showed no horizontal document overflow; desktop direct controls and sidebar were visible at 1280px.
- Measured phone completion, More, Delete, drag and exposed task-panel actions were 44×44px. This is not a claim that every control in the app meets that size: the list-title rename trigger measured 42px high.
- Created a long-name task through the grouped add icon. Opened More and read its full title. At 320×568, the open panel measured 288×111px at x=12, y≈397, inside the viewport. This checks a short viewport, not a real virtual keyboard.
- Renamed the task with Enter. A nested child's rename input measured 128px wide with 16px text; Escape cancelled and returned focus to that child's More button.
- Created a child through Enter. Saved a note and a Today date. After a full reload and reselecting the list, the saved name, date, 0/1 child progress and exact note text were present. Persistence evidence here is a fresh browser read, not an independent domain/database assertion.
- Completed the parent, opened the completed disclosure, and reopened it. The parent returned to active tasks with its date and child progress retained. Keyboard Space/ArrowUp/Space moved it above the preceding task; the UI reported order saved and displayed that order. Physical touch dragging was not exercised.
- List navigation closed after selection and returned focus to its trigger. The settings dialog at 320×568 measured 288×483px, with internally scrollable content (763px scroll height). Escape closed it and restored focus to List settings; no settings or sharing membership were changed.

Evidence screenshots contain synthetic data only: [390px](screenshots/mobile-audit-390.png), [320px](screenshots/mobile-audit-320.png). They show the saved task after keyboard reordering; the standard Next.js development badge is visible.

## Verification limits and next gate

Physical iPhone Safari and Android Chrome remain necessary for virtual-keyboard obstruction, scrolling versus drag gestures, touch-only discovery, browser chrome/safe areas, photo selection and VoiceOver/TalkBack. This review did not run network loss/retry, remote conflict, two-user sharing, revoked-access, image upload, authentication recovery or accessibility certification. Historical checks remain in their milestone documents.

Before detailed native planning, use a grocery-list session on both phones to assess the findings above, including a long title, a nested rename, notes/date editing with the keyboard open, scrolling near a drag handle, and recovery after an accidental action. Then decide native authentication and online-only versus cached reads versus queued edits explicitly. The website remains online; native offline behavior is still undecided.

## Execution and cleanup

`pnpm dev` initially encountered a local Turbopack client-module-factory reload loop in the managed-auth dependency. Responsive checks ran successfully with `node ../../scripts/next.mjs dev --webpack` from `apps/web`. An initial attempt from the repository root failed because that root is not the Next.js app. No dependency or auth implementation change was made, and no production regression is inferred from these development failures.

No build or backend integration suite was rerun for a documentation-only review. Browser viewport overrides were reset and review tabs closed. The documented fixture exited successfully through its shutdown handler, which deletes its disposable list and requests revocation of its local OAuth grant. A separate authorized domain read confirmed the disposable list returned 404. Grant revocation was not independently reread. The temporary development server was stopped, and its generated `next-env.d.ts` changes were restored. Real user content and the baseline fixture were preserved.
