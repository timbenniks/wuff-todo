import type { KeyboardEvent } from "react";

// Keep keyboard navigation within the active dialog, including the first/last
// boundary where browser chrome can otherwise receive focus. Native showModal
// still supplies the modal/inert behavior and normal interior tab order.
export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const dialog = event.currentTarget;
  const controls = [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [tabindex], [contenteditable="true"]',
    ),
  ].filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.matches(':disabled, [aria-disabled="true"]') &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
  const first = controls[0],
    last = controls.at(-1);
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last ||
      !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}
