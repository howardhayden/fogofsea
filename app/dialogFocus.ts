import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Return only controls that can actually receive focus in the current layout.
 * Keeping this test in one place makes every modal use the same keyboard
 * contract, including native disclosure summaries and responsive controls.
 */
export function visibleFocusable(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((node) => (
    !node.hidden
    && !node.closest("[inert], [aria-hidden='true']")
    && node.getAttribute("aria-hidden") !== "true"
    && node.getClientRects().length > 0
    && window.getComputedStyle(node).visibility !== "hidden"
  ));
}

/** Keep Tab and Shift+Tab inside a modal without changing its visual DOM. */
export function containDialogTab(
  event: ReactKeyboardEvent<HTMLElement> | KeyboardEvent,
  container: HTMLElement,
) {
  if (event.key !== "Tab") return false;
  const focusable = visibleFocusable(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable.at(-1)!;
  const active = document.activeElement;
  if (!container.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
