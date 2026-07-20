/** Shared helpers for page-level error surfaces across scene mounts. */

/** Writes an inline error string into a status element (builders). */
export const setInlineError = (
  element: HTMLElement | null,
  error: unknown
) => {
  if (element) {
    element.textContent = `${error}`;
  }
};
