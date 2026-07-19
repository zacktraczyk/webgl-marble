import { createExitAnimator } from "./exitAnimation";

export type ConfirmDeleteOptions = {
  title: string;
  message: string;
  /** When set, the delete button stays disabled until this exact name is typed. */
  confirmName?: string;
  onConfirm: () => void;
};

let open: ((options: ConfirmDeleteOptions) => void) | null = null;

const wire = () => {
  const dialog = document.querySelector<HTMLDialogElement>("#delete-dialog");
  const form = document.querySelector<HTMLFormElement>("#delete-form");
  const title = document.querySelector<HTMLElement>("#delete-title");
  const message = document.querySelector<HTMLElement>("#delete-message");
  const field = document.querySelector<HTMLElement>("#delete-confirm-field");
  const nameToMatch = document.querySelector<HTMLElement>(
    "#delete-confirm-name"
  );
  const input = document.querySelector<HTMLInputElement>(
    "#delete-confirm-input"
  );
  const cancel = document.querySelector<HTMLButtonElement>("#delete-cancel");
  const submit = document.querySelector<HTMLButtonElement>("#delete-submit");
  if (
    !dialog ||
    !form ||
    !title ||
    !message ||
    !field ||
    !nameToMatch ||
    !input ||
    !cancel ||
    !submit
  )
    return null;

  let options: ConfirmDeleteOptions | null = null;
  const exit = createExitAnimator(dialog);
  const close = () => {
    if (dialog.open) exit.close(() => dialog.close());
  };
  const renderSubmit = () => {
    submit.disabled =
      options?.confirmName != null &&
      input.value.trim() !== options.confirmName;
  };

  cancel.addEventListener("click", close);
  // Clicks on the backdrop land on the dialog element itself.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  // Escape fires `cancel`; intercept it so the exit animation plays first.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  input.addEventListener("input", renderSubmit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!options || submit.disabled) return;
    options.onConfirm();
    options = null;
    close();
  });

  return (next: ConfirmDeleteOptions) => {
    options = next;
    exit.cancel();
    title.textContent = next.title;
    message.textContent = next.message;
    field.hidden = next.confirmName == null;
    nameToMatch.textContent = `“${next.confirmName ?? ""}”`;
    input.value = "";
    renderSubmit();
    if (!dialog.open) dialog.showModal();
    if (next.confirmName != null) input.focus();
  };
};

/**
 * Opens the shared delete-confirmation dialog (`ConfirmDeleteDialog.astro`).
 * Falls back to the browser confirm on pages missing the dialog markup.
 */
export const openConfirmDelete = (options: ConfirmDeleteOptions) => {
  open ??= wire();
  if (open) open(options);
  else if (window.confirm(`${options.title} ${options.message}`)) {
    options.onConfirm();
  }
};
