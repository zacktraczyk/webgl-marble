/**
 * Video-player toolbar behavior: mouse activity slides the top/bottom chrome
 * (and edge vignette) out; a beat of stillness tucks it away again. The chrome
 * stays out while a control is hovered or focused, while paused, and on the
 * winner screen.
 */
export function setupChromeAutoHide(
  root: HTMLElement,
  signal?: AbortSignal
): () => void {
  const CHROME_HIDE_DELAY_MS = 2600;
  const chrome = ["#race-back-link", "#race-leg-pill", "#race-controls"].flatMap(
    (selector) => [...root.querySelectorAll<HTMLElement>(selector)]
  );
  let hideTimer: number | undefined;

  const chromeEngaged = () =>
    root.dataset.raceState === "paused" ||
    root.dataset.raceState === "complete" ||
    chrome.some(
      (element) =>
        element.matches(":hover") || element.contains(document.activeElement)
    );

  const hideChrome = () => {
    if (chromeEngaged()) {
      scheduleHide();
      return;
    }
    root.dataset.chrome = "hidden";
  };

  const scheduleHide = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideChrome, CHROME_HIDE_DELAY_MS);
  };

  const showChrome = () => {
    root.dataset.chrome = "visible";
    scheduleHide();
  };

  const onPointerLeave = () => {
    window.clearTimeout(hideTimer);
    hideChrome();
  };

  root.addEventListener("pointermove", showChrome, { signal });
  root.addEventListener("pointerdown", showChrome, { signal });
  window.addEventListener("keydown", showChrome, { signal });
  document.addEventListener("focusin", showChrome, { signal });
  root.addEventListener("pointerleave", onPointerLeave, { signal });

  // Pausing and the winner screen re-reveal the chrome even without mouse
  // movement (e.g. pause via keyboard, race finishing on its own).
  const observer = new MutationObserver(() => {
    if (
      root.dataset.raceState === "paused" ||
      root.dataset.raceState === "complete"
    ) {
      showChrome();
    }
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["data-race-state"],
  });
  signal?.addEventListener("abort", () => observer.disconnect(), {
    once: true,
  });

  return () => {
    window.clearTimeout(hideTimer);
    observer.disconnect();
  };
}
