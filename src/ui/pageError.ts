/** Shared helpers for page-level error surfaces across scene mounts. */

export type PageErrorAction = {
  href: string;
  label: string;
};

export type ShowPageErrorOptions = {
  title: string;
  copy: string;
  action?: PageErrorAction;
  stateSelector?: string;
  titleSelector?: string;
  copySelector?: string;
  actionSelector?: string;
};

/** Reveals a full-page error panel (race player style). */
export const showPageErrorState = ({
  title,
  copy,
  action = { href: "/", label: "Return to library" },
  stateSelector = "#race-error-state",
  titleSelector = "#race-error-title",
  copySelector = "#race-error-copy",
  actionSelector = "#race-error-action",
}: ShowPageErrorOptions) => {
  const errorState = document.querySelector<HTMLElement>(stateSelector);
  const errorTitle = document.querySelector<HTMLElement>(titleSelector);
  const errorCopy = document.querySelector<HTMLElement>(copySelector);
  const errorAction =
    document.querySelector<HTMLAnchorElement>(actionSelector);
  if (errorState) errorState.hidden = false;
  if (errorTitle) errorTitle.textContent = title;
  if (errorCopy) errorCopy.textContent = copy;
  if (errorAction) {
    errorAction.href = action.href;
    errorAction.textContent = action.label;
  }
};

/** Writes an inline error string into a status element (builders). */
export const setInlineError = (
  element: HTMLElement | null,
  error: unknown
) => {
  if (element) {
    element.textContent = `${error}`;
  }
};
