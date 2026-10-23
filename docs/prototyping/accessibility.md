# Responsive and accessible by design

Design the feature so it is usable on a phone and with a keyboard from the first prototype. Existing components provide useful defaults; each new composition still needs review.

## Viewports and content

- Inspect 320px and 390px phone widths, plus desktop around 1280px. Add intermediate widths when the layout changes. Long names, long links and expanded editors must fit without horizontal document scrolling.
- Keep compact task rows readable. Collapse secondary actions where appropriate, with visible labels when expanded. Preserve direct completion and recognizable primary actions. Mobile navigation must remain reachable.
- Let text wrap and containers shrink (`min-width: 0`); avoid fixed widths for main content. Horizontal code/table examples may scroll inside their own labelled region.
- Check both Compact and Comfortable density when changing rows. Test empty, one-item and crowded lists, subtasks, completed tasks, archived/read-only screens and different palettes.

## Input, keyboard and focus

- Target at least 44×44 CSS px for common touch actions. All icon-only controls need accessible names; decorative icons are hidden from assistive technology.
- Use real buttons, labelled inputs, native selects and native disclosure semantics. Placeholder text does not replace a label. Avoid nested interactive controls.
- Keep focus visible. Inline rename supports Enter to save and Escape to cancel; closing an editor or dialog restores focus to the trigger. A modal needs an accessible name, focus management and keyboard dismissal where appropriate.
- Reordering needs a non-drag alternative. Existing sortable controls support keyboard operation and position picking; touch scrolling must remain usable. Sorted/filtered views cannot reorder the shared list incorrectly.
- Explain validation beside its field, use aria-invalid/aria-describedby when needed, announce status without stealing focus, and do not announce every keystroke.

## State and consequences

Show loading, pending/saving, saved, empty, offline/request-failure, denied, stale/conflicting and disabled states where relevant. A failed save retains the draft and provides a clear recovery action. A prototype should distinguish simulated results from actual persistence.

Deletion has explicit confirmation and names affected subtasks/members when relevant. The cancellation path preserves data. Personal preferences must be labelled as personal rather than implying a change for the whole shared list.

## Color, motion and review limits

Text and controls must remain understandable without color. Use semantic text/icons alongside state colors. Aim for WCAG AA contrast (4.5:1 normal text, 3:1 large text and meaningful controls/focus boundaries), checking new combinations against their actual background. Preserve reduced-motion behavior; animation must not be required to understand or operate the feature.

Review keyboard sequence and focus in the rendered prototype, not only its JSX. Browser viewport checks do not prove a physical device, touch keyboard, screen reader or full accessibility conformance. State which checks were performed and leave untested behavior explicit.

Reference: [W3C guidance on text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
