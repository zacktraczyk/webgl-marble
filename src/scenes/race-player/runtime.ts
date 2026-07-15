import { CameraResizeController } from "../../engine/camera/resizeController";
import Stage from "../../engine/stage";
import { TEAM_COLORS } from "../../game/race/staging";
import {
  isRaceDocument,
  isRacePlayable,
  type RaceDocument,
} from "../../races/types";
import { AuthoredLevel } from "../level-builder/level";
import { RaceController } from "../level-builder/race";
import type { RoundConfiguration } from "../level-builder/types";
import { fallbackEliminationIndex, RaceProgression } from "./progression";

export const DEFAULT_LEG_TRANSITION_MS = 1_500;
export const DEFAULT_MAXIMUM_LEG_DURATION_MS = null;

export type RacePlayerOptions = {
  legTransitionMs?: number;
  /** Optional authoring safeguard. Normal races wait for the true one-marble finish. */
  maximumLegDurationMs?: number | null;
};

type EliminationReason = "finished" | "skipped" | "timed-out";

const optionalButtons = (root: HTMLElement, roles: readonly string[]) =>
  roles.flatMap((role) => [
    ...root.querySelectorAll<HTMLButtonElement>(`[data-role="${role}"]`),
  ]);

export class RacePlayerRuntime {
  private readonly raceDocument: RaceDocument;
  private readonly root: HTMLElement;
  private readonly stage: Stage;
  private readonly level: AuthoredLevel;
  private readonly resizeController: CameraResizeController;
  private readonly progression: RaceProgression;
  private readonly legTransitionMs: number;
  private readonly maximumLegDurationMs: number | null;
  private readonly pauseButtons: HTMLButtonElement[];
  private readonly restartButtons: HTMLButtonElement[];
  private readonly skipContinueButtons: HTMLButtonElement[];
  private raceController: RaceController | null = null;
  private transitionTimer: number | null = null;
  private pendingEliminationIndex: number | null = null;
  private legElapsedMs = 0;
  private playbackPaused = false;
  private disposed = false;
  private statusMessage = "";

  constructor(
    raceDocument: RaceDocument,
    rootElement: HTMLElement | null,
    signal: AbortSignal,
    {
      legTransitionMs = DEFAULT_LEG_TRANSITION_MS,
      maximumLegDurationMs = DEFAULT_MAXIMUM_LEG_DURATION_MS,
    }: RacePlayerOptions = {}
  ) {
    if (!isRaceDocument(raceDocument) || !isRacePlayable(raceDocument)) {
      throw new Error(
        "A playable race needs one leg for every team elimination"
      );
    }
    if (raceDocument.participants.length > TEAM_COLORS.length) {
      throw new Error(
        `Race playback supports at most ${TEAM_COLORS.length} teams`
      );
    }
    if (!Number.isFinite(legTransitionMs) || legTransitionMs < 0) {
      throw new Error("Leg transition duration must be non-negative");
    }
    if (
      maximumLegDurationMs !== null &&
      (!Number.isFinite(maximumLegDurationMs) || maximumLegDurationMs <= 0)
    ) {
      throw new Error("Maximum leg duration must be positive");
    }
    if (!rootElement) {
      throw new Error("Race player root element is required");
    }
    const canvas = rootElement.querySelector<HTMLCanvasElement>("#gl-canvas");
    if (!canvas) {
      throw new Error("Race player requires a #gl-canvas element");
    }

    this.raceDocument = structuredClone(raceDocument);
    this.root = rootElement;
    this.legTransitionMs = legTransitionMs;
    this.maximumLegDurationMs = maximumLegDurationMs;
    this.progression = new RaceProgression(
      this.raceDocument.participants.length,
      this.raceDocument.legs.length
    );
    const firstLeg = this.raceDocument.legs[0];
    const configuration = this.createRoundConfiguration(
      this.raceDocument.participants.length
    );
    this.stage = new Stage({
      width: firstLeg.level.size[0],
      height: firstLeg.level.size[1],
      vdu: { canvas },
    });
    this.level = new AuthoredLevel(
      this.stage,
      configuration,
      firstLeg.level.settings.wallThickness
    );
    this.resizeController = new CameraResizeController(
      canvas,
      this.stage.camera,
      {
        signal,
        getContentSize: () => [this.stage.width, this.stage.height],
        insets: { top: 24, right: 24, bottom: 24, left: 24 },
      }
    );
    this.pauseButtons = optionalButtons(this.root, [
      "race-pause-resume",
      "race-toggle",
    ]);
    this.restartButtons = optionalButtons(this.root, ["race-restart"]);
    this.skipContinueButtons = optionalButtons(this.root, [
      "race-skip-continue",
      "race-skip",
      "race-continue",
    ]);
    this.bindControls(signal);
    this.setText("race-name", this.raceDocument.name);

    try {
      this.startCurrentLeg();
    } catch (error) {
      this.stage.dispose();
      throw error;
    }
  }

  fixedUpdate(deltaMs: number) {
    if (
      this.disposed ||
      this.playbackPaused ||
      this.pendingEliminationIndex !== null ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }

    this.raceController?.fixedUpdate(deltaMs);
    this.legElapsedMs += Math.max(0, deltaMs);
    const snapshot = this.raceController?.snapshot;
    if (
      snapshot?.phase === "complete" &&
      snapshot.eliminatedTeamIndex !== null
    ) {
      this.scheduleElimination(snapshot.eliminatedTeamIndex, "finished");
      return;
    }
    if (
      this.maximumLegDurationMs !== null &&
      this.legElapsedMs >= this.maximumLegDurationMs
    ) {
      this.scheduleElimination(
        fallbackEliminationIndex(
          this.progression.snapshot.activeParticipantIndices
        ),
        "timed-out"
      );
    }
  }

  updateInterface() {
    if (this.disposed) {
      return;
    }
    const snapshot = this.raceController?.snapshot;
    this.root.dataset.racePhase = snapshot?.phase ?? "ready";
    this.root.dataset.raceState = this.currentState;
    if (snapshot) {
      this.setText("race-released-count", `${snapshot.releasedMarbles}`);
      this.setText("race-finished-count", `${snapshot.finishedMarbles}`);
    }
    this.setText("race-status", this.statusMessage);
    this.updateControls();
  }

  render() {
    if (!this.disposed) {
      this.stage.render();
    }
  }

  togglePause = () => {
    if (
      this.disposed ||
      this.pendingEliminationIndex !== null ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }

    this.playbackPaused = !this.playbackPaused;
    const phase = this.raceController?.snapshot.phase;
    if (phase === "running" || phase === "paused") {
      this.raceController?.toggleRunning();
    }
    this.statusMessage = this.playbackPaused
      ? "Race paused"
      : this.runningStatus;
    this.updateInterface();
  };

  restart = () => {
    if (this.disposed) {
      return;
    }
    this.clearTransitionTimer();
    this.pendingEliminationIndex = null;
    this.progression.restart();
    this.setText("race-eliminated", "");
    this.setText("race-winner", "");
    this.startCurrentLeg();
  };

  skipOrContinue = () => {
    if (this.disposed || this.progression.snapshot.winnerIndex !== null) {
      return;
    }
    if (this.pendingEliminationIndex !== null) {
      this.clearTransitionTimer();
      this.advanceAfterTransition();
      return;
    }
    this.scheduleElimination(
      fallbackEliminationIndex(
        this.progression.snapshot.activeParticipantIndices
      ),
      "skipped"
    );
  };

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearTransitionTimer();
    this.pendingEliminationIndex = null;
    this.disposeRaceController();
    this.stage.dispose();
  }

  private startCurrentLeg() {
    this.disposeRaceController();
    const progression = this.progression.snapshot;
    const leg = this.raceDocument.legs[progression.legIndex];
    if (!leg) {
      throw new Error(`Missing race leg ${progression.legIndex + 1}`);
    }
    const activeParticipantIndices = [...progression.activeParticipantIndices];
    const configuration = this.createRoundConfiguration(
      activeParticipantIndices.length
    );

    this.level.setRoundConfiguration(configuration);
    this.stage.setSize(...leg.level.size);
    this.level.restore(leg.level);
    this.raceController = new RaceController(
      this.stage,
      this.level,
      configuration,
      { stableTeamIndices: activeParticipantIndices }
    );
    this.raceController.reset();
    const spawnPoint = this.level.find("spawn-point");
    if (spawnPoint) {
      this.level.setVisible(spawnPoint.id, false);
    }

    this.legElapsedMs = 0;
    this.playbackPaused = false;
    this.pendingEliminationIndex = null;
    this.root.dataset.legIndex = `${progression.legIndex}`;
    this.setText("race-leg-name", leg.name);
    this.setText(
      "race-leg-progress",
      `Leg ${progression.legIndex + 1} of ${this.raceDocument.legs.length}`
    );
    this.setText("race-eliminated", "");
    this.setText("race-winner", "");
    this.updateActiveParticipants();
    this.resizeController.fit();

    this.raceController.toggleRunning();
    this.statusMessage = this.runningStatus;
    this.updateInterface();
  }

  private scheduleElimination(
    stableParticipantIndex: number,
    reason: EliminationReason
  ) {
    if (
      this.pendingEliminationIndex !== null ||
      this.progression.snapshot.winnerIndex !== null ||
      !this.progression.snapshot.activeParticipantIndices.includes(
        stableParticipantIndex
      )
    ) {
      return;
    }

    this.pendingEliminationIndex = stableParticipantIndex;
    this.playbackPaused = false;
    if (this.raceController?.snapshot.phase === "running") {
      this.raceController.toggleRunning();
    }
    const participant = this.raceDocument.participants[stableParticipantIndex];
    const message =
      reason === "timed-out"
        ? `Leg timed out — ${participant.name} team is eliminated.`
        : reason === "skipped"
          ? `Leg skipped — ${participant.name} team is eliminated.`
          : `${participant.name} has the final marble on the track and is eliminated.`;
    this.statusMessage = message;
    this.setText("race-eliminated", participant.name);
    this.updateInterface();
    this.transitionTimer = window.setTimeout(
      this.advanceAfterTransition,
      this.legTransitionMs
    );
  }

  private readonly advanceAfterTransition = () => {
    if (this.disposed || this.pendingEliminationIndex === null) {
      return;
    }
    this.clearTransitionTimer();
    const eliminatedParticipantIndex = this.pendingEliminationIndex;
    this.pendingEliminationIndex = null;
    const result = this.progression.eliminate(eliminatedParticipantIndex);
    this.updateActiveParticipants();

    if (result.winnerIndex !== null) {
      const winner = this.raceDocument.participants[result.winnerIndex];
      this.statusMessage = `${winner.name} wins ${this.raceDocument.name}!`;
      this.setText("race-winner", winner.name);
      this.updateInterface();
      return;
    }
    this.startCurrentLeg();
  };

  private disposeRaceController() {
    if (!this.raceController) {
      return;
    }
    this.raceController.reset();
    this.raceController.dispose();
    this.raceController = null;
  }

  private createRoundConfiguration(teamCount: number): RoundConfiguration {
    return {
      teamCount,
      marblesPerTeam: this.raceDocument.rules.marblesPerTeam,
      releaseIntervalMs: this.raceDocument.releaseIntervalMs,
    };
  }

  private bindControls(signal: AbortSignal) {
    for (const button of this.pauseButtons) {
      button.addEventListener("click", this.togglePause, { signal });
    }
    for (const button of this.restartButtons) {
      button.addEventListener("click", this.restart, { signal });
    }
    for (const button of this.skipContinueButtons) {
      button.addEventListener("click", this.skipOrContinue, { signal });
    }
  }

  private updateControls() {
    const winnerDeclared = this.progression.snapshot.winnerIndex !== null;
    const transitioning = this.pendingEliminationIndex !== null;
    for (const button of this.pauseButtons) {
      button.disabled = winnerDeclared || transitioning;
      button.textContent = this.playbackPaused ? "Resume" : "Pause";
      button.setAttribute("aria-pressed", `${this.playbackPaused}`);
    }
    for (const button of this.restartButtons) {
      button.disabled = false;
    }
    for (const button of this.skipContinueButtons) {
      button.disabled = winnerDeclared;
      button.textContent = transitioning ? "Continue" : "Skip leg";
    }
  }

  private updateActiveParticipants() {
    const activeIndices = this.progression.snapshot.activeParticipantIndices;
    const names = activeIndices.map(
      (index) => this.raceDocument.participants[index].name
    );
    this.setText("race-active-participants", names.join(", "));
    this.setText("race-active-count", `${activeIndices.length}`);
    for (const row of this.root.querySelectorAll<HTMLElement>(
      "[data-team-index]"
    )) {
      row.dataset.active = `${activeIndices.includes(
        Number(row.dataset.teamIndex)
      )}`;
    }
  }

  private setText(role: string, text: string) {
    for (const element of this.root.querySelectorAll<HTMLElement>(
      `[data-role="${role}"]`
    )) {
      element.textContent = text;
    }
  }

  private clearTransitionTimer() {
    if (this.transitionTimer === null) {
      return;
    }
    window.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }

  private get runningStatus() {
    const courseIssue = this.raceController?.snapshot.courseIssue;
    if (courseIssue) {
      return `${courseIssue}. This leg will time out or can be skipped.`;
    }
    const progression = this.progression.snapshot;
    const leg = this.raceDocument.legs[progression.legIndex];
    return `Racing leg ${progression.legIndex + 1}: ${leg.name} · ${progression.activeParticipantIndices.length} teams · ${this.raceDocument.rules.marblesPerTeam} marbles each`;
  }

  private get currentState() {
    if (this.progression.snapshot.winnerIndex !== null) {
      return "complete";
    }
    if (this.pendingEliminationIndex !== null) {
      return "transition";
    }
    if (this.playbackPaused) {
      return "paused";
    }
    if (this.raceController?.snapshot.courseIssue) {
      return "blocked";
    }
    return "running";
  }
}
