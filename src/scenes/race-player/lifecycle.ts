export type RacePlayerLifecycleEvent =
  | { type: "started"; runNumber: number }
  | {
      type: "completed";
      durationMs: number;
      runNumber: number;
      winnerTeamIndex: number;
    };

type RacePlayerLifecycleListener = (event: RacePlayerLifecycleEvent) => void;

/** Tracks full-race run numbering and active elapsed time for product events. */
export class RaceRunLifecycle {
  private readonly listener?: RacePlayerLifecycleListener;
  private elapsedMs = 0;
  private runNumber = 0;

  constructor(listener?: RacePlayerLifecycleListener) {
    this.listener = listener;
  }

  prepareRun() {
    this.elapsedMs = 0;
  }

  startRun() {
    this.runNumber++;
    this.listener?.({ type: "started", runNumber: this.runNumber });
  }

  advance(deltaMs: number) {
    this.elapsedMs += Math.max(0, deltaMs);
  }

  completeRun(winnerTeamIndex: number) {
    this.listener?.({
      type: "completed",
      durationMs: Math.round(this.elapsedMs),
      runNumber: this.runNumber,
      winnerTeamIndex,
    });
  }
}
