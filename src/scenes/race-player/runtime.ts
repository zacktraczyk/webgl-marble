import Stage from "../../engine/stage";
import {
  computeEraSchedule,
  type LegFinishPlan,
} from "../../game/race/eraSchedule";
import { TEAM_COLORS } from "../../game/race/staging";
import {
  isRaceDocument,
  isRacePlayable,
  type RaceDocument,
} from "../../races/types";
import {
  MAX_MARBLE_RADIUS,
  MIN_MARBLE_RADIUS,
  STAGING_MARBLE_GAP,
} from "../level-builder/constants";
import type { RoundConfiguration } from "../level-builder/types";
import { LegInstance } from "./legInstance";
import { computeLegStackLayout, type LegFrame } from "./legStack";
import { fallbackEliminationIndex, RaceProgression } from "./progression";
import { RaceCameraController } from "./raceCamera";

export const DEFAULT_MAXIMUM_LEG_DURATION_MS = null;

/**
 * Vertical padding, in screen pixels, the scrolling camera keeps around the
 * active leg. Horizontal insets stay zero so the leg walls sit flush with the
 * viewport edges.
 */
const CAMERA_INSET = 24;
/**
 * Fraction of the incoming leg that must be on screen before its marbles start
 * releasing — the "marble transfer" hand-off point mid-scroll.
 */
const NEXT_LEG_RELEASE_FRACTION = 2 / 3;

export type RacePlayerOptions = {
  /** Optional authoring safeguard. Normal races wait for the true one-marble finish. */
  maximumLegDurationMs?: number | null;
};

type EliminationReason = "finished" | "skipped" | "timed-out";

type LegWindow = {
  previous: LegInstance | null;
  current: LegInstance;
  next: LegInstance | null;
};

type Transition = {
  released: boolean;
  oldLeg: LegInstance;
};

const COUNTDOWN_STEPS = [
  { label: "3", step: "3" },
  { label: "2", step: "2" },
  { label: "1", step: "1" },
  { label: "GO!", step: "go" },
] as const;
const COUNTDOWN_STEP_MS = 650;
const COUNTDOWN_GO_HOLD_MS = 700;
const COUNTDOWN_EXIT_MS = 300;
/** Clear-track pause between the countdown overlay leaving and marble release. */
const TRACK_REVEAL_HOLD_MS = 200;

const optionalButtons = (root: HTMLElement, roles: readonly string[]) =>
  roles.flatMap((role) => [
    ...root.querySelectorAll<HTMLButtonElement>(`[data-role="${role}"]`),
  ]);

export class RacePlayerRuntime {
  private readonly raceDocument: RaceDocument;
  private readonly root: HTMLElement;
  private readonly stage: Stage;
  private readonly progression: RaceProgression;
  private readonly maximumLegDurationMs: number | null;
  private readonly pauseButtons: HTMLButtonElement[];
  private readonly restartButtons: HTMLButtonElement[];
  private readonly skipContinueButtons: HTMLButtonElement[];
  private readonly layout: LegFrame[];
  private readonly finishSchedule: LegFinishPlan[];
  private readonly cameraController: RaceCameraController;
  private legWindow: LegWindow | null = null;
  private transition: Transition | null = null;
  private countdownTimers: number[] = [];
  private countdownActive = false;
  private legElapsedMs = 0;
  private playbackPaused = false;
  private disposed = false;
  private statusMessage = "";

  constructor(
    raceDocument: RaceDocument,
    rootElement: HTMLElement | null,
    signal: AbortSignal,
    {
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
    this.maximumLegDurationMs = maximumLegDurationMs;
    this.progression = new RaceProgression(
      this.raceDocument.participants.length,
      this.raceDocument.legs.length
    );
    const firstLeg = this.raceDocument.legs[0];
    this.stage = new Stage({
      width: firstLeg.level.size[0],
      height: firstLeg.level.size[1],
      vdu: { canvas },
    });
    // Every leg's finish rack layout — bay counts, X'd bays, and heights —
    // is deterministic (one elimination per leg), so plan the whole race now.
    this.finishSchedule = computeEraSchedule({
      participantCount: this.raceDocument.participants.length,
      marblesPerTeam: this.raceDocument.rules.marblesPerTeam,
      legs: this.raceDocument.legs.map((leg) => ({
        width: leg.level.size[0],
        wallThickness: leg.level.settings.wallThickness,
      })),
      marbleRadius: MAX_MARBLE_RADIUS,
      minimumRadius: MIN_MARBLE_RADIUS,
      gap: STAGING_MARBLE_GAP,
    });
    this.layout = computeLegStackLayout(
      this.raceDocument.legs,
      this.finishSchedule
    );

    // Size the stage once to the whole stack's bounding box. Nothing in this
    // scene culls against stage bounds anymore (each leg controller owns its
    // own bounds), so this is defensive only.
    const stackWidth = Math.max(...this.layout.map((frame) => frame.size[0]));
    const stackHeight =
      this.layout[this.layout.length - 1].bottom - this.layout[0].top;
    this.stage.setSize(stackWidth, stackHeight);
    // The runtime owns global physics now; enable it once and leave it on.
    // Pausing freezes the sim by skipping `fixedUpdate`, not by toggling this.
    this.stage.physicsEnabled = true;

    this.cameraController = new RaceCameraController(canvas, this.stage.camera, {
      insets: { top: CAMERA_INSET, bottom: CAMERA_INSET, left: 0, right: 0 },
    });

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
      this.startRace();
    } catch (error) {
      this.stage.dispose();
      throw error;
    }
  }

  fixedUpdate(deltaMs: number) {
    if (
      this.disposed ||
      this.countdownActive ||
      this.playbackPaused ||
      this.legWindow === null ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }

    const legWindow = this.legWindow;
    legWindow.previous?.fixedUpdate(deltaMs);
    legWindow.current.fixedUpdate(deltaMs);
    if (this.transition?.released) {
      legWindow.next?.fixedUpdate(deltaMs);
    }
    // Single stage-stepping point for the whole stack.
    this.stage.update(deltaMs);

    // While scrolling, the "current" leg is the finished one; its completion
    // has already been consumed, so do not re-trigger a transition from it.
    if (this.transition) {
      return;
    }

    this.legElapsedMs += Math.max(0, deltaMs);
    const snapshot = legWindow.current.controller?.snapshot;
    if (
      snapshot?.phase === "complete" &&
      snapshot.eliminatedTeamIndex !== null
    ) {
      this.beginTransition(snapshot.eliminatedTeamIndex, "finished");
      return;
    }
    if (
      this.maximumLegDurationMs !== null &&
      this.legElapsedMs >= this.maximumLegDurationMs
    ) {
      this.beginTransition(
        fallbackEliminationIndex(
          this.progression.snapshot.activeParticipantIndices
        ),
        "timed-out"
      );
    }
  }

  update(deltaMs: number) {
    if (this.disposed || this.legWindow === null) {
      return;
    }

    const legWindow = this.legWindow;
    // Refit every frame (handles resize); glide progress freezes while paused.
    this.cameraController.update(deltaMs, { advance: !this.playbackPaused });

    if (this.transition && !this.playbackPaused) {
      const nextLeg = legWindow.next;
      if (
        nextLeg &&
        !this.transition.released &&
        this.cameraController.visibleFractionOf(nextLeg.worldRect) >=
          NEXT_LEG_RELEASE_FRACTION
      ) {
        this.releaseNextLeg();
      }
      if (!this.cameraController.gliding) {
        this.finalizeTransition();
      }
    }

    this.updateInterface();
  }

  render() {
    if (!this.disposed) {
      this.stage.render();
    }
  }

  togglePause = () => {
    if (
      this.disposed ||
      this.countdownActive ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }

    // Pausing is allowed during a scroll transition: it stops `fixedUpdate`
    // stepping, freezes the camera glide (via `advance`), and gates the
    // release/finalize logic in `update`, so the whole transition simply holds.
    this.playbackPaused = !this.playbackPaused;
    this.statusMessage = this.playbackPaused
      ? "Race paused"
      : this.runningStatus;
    this.updateInterface();
  };

  restart = () => {
    if (this.disposed) {
      return;
    }
    this.teardownLegs();
    this.progression.restart();
    this.setText("race-eliminated", "");
    this.setText("race-winner", "");
    this.startRace();
  };

  skipOrContinue = () => {
    if (
      this.disposed ||
      this.countdownActive ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }
    if (this.transition) {
      // Jump-cut the scroll; `finalizeTransition` runs on the next update tick.
      this.cameraController.completeGlide();
      return;
    }
    this.beginTransition(
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
    this.clearCountdown();
    this.teardownLegs();
    this.stage.dispose();
  }

  private startRace() {
    this.transition = null;
    this.legElapsedMs = 0;
    this.playbackPaused = false;

    const progression = this.progression.snapshot;
    const current = this.buildLeg(progression.legIndex);
    const nextIndex = progression.legIndex + 1;
    const next = this.layout[nextIndex] ? this.buildLeg(nextIndex) : null;
    current.attachController([...progression.activeParticipantIndices]);
    this.legWindow = { previous: null, current, next };

    this.cameraController.snapTo(current.worldRect);

    const leg = this.raceDocument.legs[progression.legIndex];
    this.root.dataset.legIndex = `${progression.legIndex}`;
    this.setText("race-leg-name", leg.name);
    this.setText(
      "race-leg-progress",
      `Leg ${progression.legIndex + 1} of ${this.raceDocument.legs.length}`
    );
    this.setText("race-eliminated", "");
    this.setText("race-winner", "");
    this.updateActiveParticipants();

    // Leg 0 always opens with the countdown; the stack is otherwise idle.
    this.beginCountdown();
  }

  private buildLeg(index: number): LegInstance {
    const leg = this.raceDocument.legs[index];
    return new LegInstance({
      stage: this.stage,
      leg,
      frame: this.layout[index],
      configuration: this.createRoundConfiguration(index),
    });
  }

  private beginTransition(
    eliminatedStableIndex: number,
    reason: EliminationReason
  ) {
    if (
      this.legWindow === null ||
      this.transition !== null ||
      this.progression.snapshot.winnerIndex !== null ||
      !this.progression.snapshot.activeParticipantIndices.includes(
        eliminatedStableIndex
      )
    ) {
      return;
    }

    const legWindow = this.legWindow;
    // On a skip/timeout the leg has no natural survivor yet — freeze whatever is
    // still live into the finish pool so its colors are still drainable above.
    if (reason !== "finished") {
      legWindow.current.controller?.abandon();
    }

    const oldLeg = legWindow.current;
    const result = this.progression.eliminate(eliminatedStableIndex);
    this.updateActiveParticipants();

    if (result.winnerIndex !== null) {
      const winner = this.raceDocument.participants[result.winnerIndex];
      this.statusMessage = `${winner.name} wins ${this.raceDocument.name}!`;
      this.setText("race-winner", winner.name);
      this.setText("race-eliminated", "");
      // Camera stays on the final leg; the frozen field is the end tableau.
      this.updateInterface();
      return;
    }

    const nextLeg = legWindow.next;
    if (!nextLeg) {
      // A non-winning elimination always has a leg to scroll to; guard anyway.
      return;
    }

    const participant = this.raceDocument.participants[eliminatedStableIndex];
    this.statusMessage =
      reason === "timed-out"
        ? `Leg timed out — ${participant.name} team is eliminated.`
        : reason === "skipped"
          ? `Leg skipped — ${participant.name} team is eliminated.`
          : `${participant.name} has the final marble on the track and is eliminated.`;
    this.setText("race-eliminated", participant.name);

    // Each marble the incoming leg releases drains one finished marble of the
    // same color from the bays above, selling the transfer.
    nextLeg.attachController([...result.activeParticipantIndices], {
      onMarbleReleased: (stableTeamIndex) =>
        oldLeg.removeFinishedMarble(stableTeamIndex),
    });

    // At most two finished legs can be alive; retire the older one now.
    if (legWindow.previous) {
      legWindow.previous.dispose();
      legWindow.previous = null;
    }

    this.cameraController.glideTo(nextLeg.worldRect);
    this.transition = { released: false, oldLeg };
    this.updateInterface();
  }

  private releaseNextLeg() {
    this.legWindow?.next?.controller?.toggleRunning();
    if (this.transition) {
      this.transition.released = true;
    }
  }

  private finalizeTransition() {
    if (this.legWindow === null || this.transition === null) {
      return;
    }
    const legWindow = this.legWindow;
    const nextLeg = legWindow.next;
    if (!nextLeg) {
      return;
    }

    // If the scroll finished before the 2/3 hand-off fired, release now.
    if (!this.transition.released) {
      this.releaseNextLeg();
    }
    const oldLeg = this.transition.oldLeg;
    this.transition = null;

    // Slide the window down one leg and pre-build the following leg's geometry.
    legWindow.previous = oldLeg;
    legWindow.current = nextLeg;
    const legIndex = this.progression.snapshot.legIndex;
    const followingIndex = legIndex + 1;
    legWindow.next = this.layout[followingIndex]
      ? this.buildLeg(followingIndex)
      : null;

    this.legElapsedMs = 0;

    const leg = this.raceDocument.legs[legIndex];
    this.root.dataset.legIndex = `${legIndex}`;
    this.setText("race-leg-name", leg.name);
    this.setText(
      "race-leg-progress",
      `Leg ${legIndex + 1} of ${this.raceDocument.legs.length}`
    );
    this.setText("race-eliminated", "");
    this.statusMessage = this.runningStatus;

    // Drop the just-finished leg immediately if it has already scrolled fully
    // out of view; otherwise it lingers (still ticking motion) until the next
    // transition retires it.
    if (
      this.cameraController.visibleFractionOf(oldLeg.worldRect) === 0
    ) {
      oldLeg.dispose();
      legWindow.previous = null;
    }

    this.updateInterface();
  }

  private launchCurrentLeg() {
    this.legWindow?.current.controller?.toggleRunning();
    this.statusMessage = this.runningStatus;
    this.updateInterface();
  }

  private teardownLegs() {
    this.clearCountdown();
    this.transition = null;
    if (this.legWindow) {
      this.legWindow.previous?.dispose();
      this.legWindow.current.dispose();
      this.legWindow.next?.dispose();
      this.legWindow = null;
    }
  }

  private beginCountdown() {
    const overlay = this.root.querySelector<HTMLElement>("#race-countdown");
    const value = this.root.querySelector<HTMLElement>("#race-countdown-value");
    if (!overlay || !value) {
      this.launchCurrentLeg();
      return;
    }

    this.clearCountdown();
    this.countdownActive = true;
    this.statusMessage = "On your marks…";
    overlay.hidden = false;
    delete overlay.dataset.step;
    value.textContent = "";
    this.updateInterface();

    COUNTDOWN_STEPS.forEach(({ label, step }, index) => {
      this.countdownTimers.push(
        window.setTimeout(() => {
          overlay.dataset.step = step;
          value.textContent = label;
        }, index * COUNTDOWN_STEP_MS)
      );
    });

    const goShownAt = (COUNTDOWN_STEPS.length - 1) * COUNTDOWN_STEP_MS;
    const overlayGoneAt = goShownAt + COUNTDOWN_GO_HOLD_MS + COUNTDOWN_EXIT_MS;
    this.countdownTimers.push(
      window.setTimeout(() => {
        overlay.dataset.step = "done";
      }, goShownAt + COUNTDOWN_GO_HOLD_MS)
    );
    this.countdownTimers.push(
      window.setTimeout(() => {
        overlay.hidden = true;
      }, overlayGoneAt)
    );
    // Hold the marbles until the track has been visible for a beat, so the
    // release is never hidden behind the countdown overlay.
    this.countdownTimers.push(
      window.setTimeout(() => {
        this.countdownActive = false;
        this.launchCurrentLeg();
      }, overlayGoneAt + TRACK_REVEAL_HOLD_MS)
    );
  }

  private clearCountdown() {
    for (const timer of this.countdownTimers) {
      window.clearTimeout(timer);
    }
    this.countdownTimers = [];
    this.countdownActive = false;
    const overlay = this.root.querySelector<HTMLElement>("#race-countdown");
    if (overlay) {
      overlay.hidden = true;
      delete overlay.dataset.step;
    }
  }

  private updateInterface() {
    if (this.disposed) {
      return;
    }
    const snapshot = this.legWindow?.current.controller?.snapshot;
    this.root.dataset.racePhase = snapshot?.phase ?? "ready";
    this.root.dataset.raceState = this.currentState;
    if (snapshot) {
      this.setText("race-released-count", `${snapshot.releasedMarbles}`);
      this.setText("race-finished-count", `${snapshot.finishedMarbles}`);
    }
    this.setText("race-status", this.statusMessage);
    this.updateControls();
  }

  private createRoundConfiguration(legIndex: number): RoundConfiguration {
    const plan = this.finishSchedule[legIndex];
    return {
      // Leg `i` runs with the field it inherits: N participants minus the `i`
      // teams eliminated on the legs before it. Eliminated teams' marbles are
      // redistributed, so the per-team count grows leg over leg.
      teamCount: plan.activeTeams,
      marblesPerTeam: plan.marblesPerTeam,
      releaseIntervalMs: this.raceDocument.releaseIntervalMs,
      finishPlan: {
        bayCount: plan.bayCount,
        xBayCount: plan.xBayCount,
        rackHeight: plan.rackHeight,
        marbleRadius: plan.marbleRadius,
      },
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
    const transitioning = this.transition !== null;
    for (const button of this.pauseButtons) {
      // Pause stays available during a transition (only the countdown and a
      // declared winner disable it).
      button.disabled = winnerDeclared || this.countdownActive;
      button.setAttribute(
        "aria-label",
        this.playbackPaused ? "Resume race" : "Pause race"
      );
      button.setAttribute("aria-pressed", `${this.playbackPaused}`);
    }
    for (const button of this.restartButtons) {
      button.disabled = false;
    }
    for (const button of this.skipContinueButtons) {
      button.disabled = winnerDeclared || this.countdownActive;
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

  private get runningStatus() {
    const courseIssue = this.legWindow?.current.controller?.snapshot.courseIssue;
    if (courseIssue) {
      return `${courseIssue}. This leg will time out or can be skipped.`;
    }
    const progression = this.progression.snapshot;
    const leg = this.raceDocument.legs[progression.legIndex];
    const marblesPerTeam =
      this.finishSchedule[progression.legIndex]?.marblesPerTeam ??
      this.raceDocument.rules.marblesPerTeam;
    return `Racing leg ${progression.legIndex + 1}: ${leg.name} · ${progression.activeParticipantIndices.length} teams · ${marblesPerTeam} marbles each`;
  }

  private get currentState() {
    if (this.progression.snapshot.winnerIndex !== null) {
      return "complete";
    }
    if (this.transition !== null) {
      return "transition";
    }
    if (this.countdownActive) {
      return "countdown";
    }
    if (this.playbackPaused) {
      return "paused";
    }
    if (this.legWindow?.current.controller?.snapshot.courseIssue) {
      return "blocked";
    }
    return "running";
  }
}
