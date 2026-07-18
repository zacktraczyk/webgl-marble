/** Shared helpers for scene playback chrome (countdown, preview flags). */

/** Clear every timeout id in `timers` and empty the array in place. */
export const clearTimeoutIds = (timers: number[]) => {
  for (const id of timers) {
    window.clearTimeout(id);
  }
  timers.length = 0;
};

export type ScheduledTimeout = {
  delayMs: number;
  run: () => void;
};

/** Append setTimeout handles for each step into `timers`. */
export const scheduleTimeouts = (
  timers: number[],
  steps: readonly ScheduledTimeout[]
) => {
  for (const step of steps) {
    timers.push(window.setTimeout(step.run, step.delayMs));
  }
};

/** Write a boolean into `element.dataset[key]` as `"true"` / `"false"`. */
export const setDatasetFlag = (
  element: HTMLElement,
  key: string,
  value: boolean
) => {
  element.dataset[key] = `${value}`;
};
