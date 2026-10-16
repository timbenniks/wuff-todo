# Mobile website layout

Updated: October 16, 2026

The website adapts the existing Wuff palette, typography and Waffles identity for narrow screens. This milestone streamlines the online website; native apps and offline behaviour remain unchanged.

## Interaction decisions

- Below 768px, a compact Wuff header has a Lists disclosure. It reveals the existing list navigation, creation, archive, personal reordering, connections and sign-out controls. Choosing a list closes the disclosure and returns focus to its trigger; Escape also closes it. The desktop sidebar stays visible.
- Below 640px, task names have their own line beside the completion control. An action row below keeps Edit, Notes, existing subtask progress and the drag handle directly available. More reveals labelled Date, Delete and Add subtasks actions. Hidden actions leave the tab order; the disclosure exposes its expanded state and controlled region. Escape closes the extra actions.
- Inline task/subtask editing uses the available name width and hides the action row until editing finishes. Save/Cancel remain together when space permits; long conflict/retry labels may wrap. Input text is 16px. Completion and task action targets are at least 44px.
- Notes and date panels use the available row width. Subtasks keep a shallow branch indent; their duplicate progress sentence is omitted on phones because the parent already displays progress.
- The rich-text toolbar is one horizontally scrollable strip on phones, with 44px buttons. Every existing formatting/image command remains available through scrolling or keyboard focus. The editor starts at 128px and scrolls beyond 40dvh. Desktop toolbar wrapping and editor sizing are retained.
- Existing permissions, confirmation behaviour, versioning, retries, in-memory drafts and Markdown persistence are unchanged. No API, domain, database, OAuth or MCP App changes are included.

## Verification

- Final `pnpm check` passed: workspace/root TypeScript, all 25 unit tests, optimized Next.js and MCP App builds. Static scanning of 20 browser scripts found no server secrets or domain SQL. No new implementation-mirroring unit tests were added for responsive styling. The backend integration suite was not rerun for this website-only change; historical integration results remain in their milestone documents.
- The optimized local build used a real synthetic development session and a disposable list on the existing isolated Neon branch. At 390px, combined subtask/name and rich-note editing measured a 284px name input, a 348px toolbar and a 128px editor. At 320px, the name input measured 214px. Both widths had `documentElement.scrollWidth === innerWidth`, including open editors.
- Browser actions exercised list disclosure/selection, direct Edit/Notes, inline name save, bold note save/reopen, Escape cancellation, More keyboard access, date saving, focus return to More after saving a hidden date action, and pointer drag through the exposed handle. A separate domain read verified the exact name, bold Markdown, date and reordered roots, with parent/child relationships and completion preserved.
- The 1280px desktop view retained its visible sidebar and direct task controls, without horizontal overflow. [Combined phone editors](screenshots/mobile-streamlined-editing.jpg) use only synthetic development content.
- Responsive browser proof does not certify physical iOS/Android keyboards, touch gestures or screen readers. Production release evidence and fixture cleanup will be recorded after deployment.
