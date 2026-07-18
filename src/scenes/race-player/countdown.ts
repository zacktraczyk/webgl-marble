import { clearTimeoutIds, scheduleTimeouts } from "../playbackTimers";

export const COUNTDOWN_STEPS = [
  { label: "3", step: "3" },
  { label: "2", step: "2" },
  { label: "1", step: "1" },
  { label: "GO!", step: "go" },
] as const;
export const COUNTDOWN_STEP_MS = 650;
export const COUNTDOWN_GO_HOLD_MS = 700;
export const COUNTDOWN_EXIT_MS = 300;
/** Clear-track pause between the countdown overlay leaving and marble release. */
export const TRACK_REVEAL_HOLD_MS = 200;

export type BeginCountdownArgs = {
  root: HTMLElement;
  /** Called once the countdown has fully finished and marbles should release. */
  onComplete: () => void;
  /** Called with the "On your marks…" status line as the countdown starts. */
  onStatus: (message: string) => void;
};

/**
 * Drives the "3, 2, 1, GO!" overlay shown at the start of every leg. Owns the
 * overlay's DOM (`#race-countdown` / `#race-countdown-value`) and the timers
 * that step through it; callers only learn about status text and completion.
 */
export class RaceCountdown {
  private timers: number[] = [];
  private isActive = false;
  private root: HTMLElement | null = null;

  get active() {
    return this.isActive;
  }

  begin({ root, onComplete, onStatus }: BeginCountdownArgs) {
    this.root = root;
    const overlay = root.querySelector<HTMLElement>("#race-countdown");
    const value = root.querySelector<HTMLElement>("#race-countdown-value");
    if (!overlay || !value) {
      onComplete();
      return;
    }

    this.clear();
    this.isActive = true;
    onStatus("On your marks…");
    overlay.hidden = false;
    delete overlay.dataset.step;
    value.textContent = "";

    const steps: Array<{ delayMs: number; run: () => void }> = [
      ...COUNTDOWN_STEPS.map(({ label, step }, index) => ({
        delayMs: index * COUNTDOWN_STEP_MS,
        run: () => {
          overlay.dataset.step = step;
          value.textContent = label;
        },
      })),
    ];

    const goShownAt = (COUNTDOWN_STEPS.length - 1) * COUNTDOWN_STEP_MS;
    const overlayGoneAt = goShownAt + COUNTDOWN_GO_HOLD_MS + COUNTDOWN_EXIT_MS;
    steps.push(
      {
        delayMs: goShownAt + COUNTDOWN_GO_HOLD_MS,
        run: () => {
          overlay.dataset.step = "done";
        },
      },
      {
        delayMs: overlayGoneAt,
        run: () => {
          overlay.hidden = true;
        },
      },
      {
        // Hold the marbles until the track has been visible for a beat, so the
        // release is never hidden behind the countdown overlay.
        delayMs: overlayGoneAt + TRACK_REVEAL_HOLD_MS,
        run: () => {
          this.isActive = false;
          onComplete();
        },
      }
    );
    scheduleTimeouts(this.timers, steps);
  }

  clear() {
    clearTimeoutIds(this.timers);
    this.isActive = false;
    const overlay = this.root?.querySelector<HTMLElement>("#race-countdown");
    if (overlay) {
      overlay.hidden = true;
      delete overlay.dataset.step;
    }
  }
}
