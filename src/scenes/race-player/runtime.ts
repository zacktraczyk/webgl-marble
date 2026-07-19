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
} from "../../game/level/constants";
import { computeLegStackLayout, type LegFrame } from "./legStack";
import { fallbackEliminationIndex, RaceProgression } from "./progression";
import { RaceCameraController } from "./raceCamera";
import { RaceCountdown } from "./countdown";
import { RacePlayerPresenter } from "./presenter";
import { setupChromeAutoHide } from "./chromeAutoHide";
import {
  bindRacePlayerControls,
  runningLegStatus,
} from "./controls";
import {
  NEXT_LEG_RELEASE_FRACTION,
  type LegWindow,
  type Transition,
} from "./transition";
import {
  beginTransition,
  finalizeTransition,
  releaseNextLeg,
  type TransitionHost,
} from "./transitionController";
import {
  buildLeg,
  startRace,
  teardownLegs,
  type LegLifecycleHost,
} from "./legLifecycle";

export const DEFAULT_MAXIMUM_LEG_DURATION_MS = null;

/**
 * Vertical padding, in screen pixels, the scrolling camera keeps around the
 * active leg. Horizontal insets stay zero so the leg walls sit flush with the
 * viewport edges.
 */
const CAMERA_INSET = 24;

export type RacePlayerOptions = {
  /** Optional authoring safeguard. Normal races wait for the true one-marble finish. */
  maximumLegDurationMs?: number | null;
};

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
  private readonly backLink: HTMLAnchorElement | null;
  private readonly pauseButtons: HTMLButtonElement[];
  private readonly restartButtons: HTMLButtonElement[];
  private readonly skipContinueButtons: HTMLButtonElement[];
  private readonly layout: LegFrame[];
  private readonly finishSchedule: LegFinishPlan[];
  private readonly cameraController: RaceCameraController;
  private readonly presenter: RacePlayerPresenter;
  private readonly countdown = new RaceCountdown();
  private legWindow: LegWindow | null = null;
  private transition: Transition | null = null;
  private legElapsedMs = 0;
  private playbackPaused = false;
  private disposed = false;
  private statusMessage = "";
  private readonly lifecycleHost: LegLifecycleHost;
  private readonly transitionHost: TransitionHost;

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
    this.backLink =
      this.root.querySelector<HTMLAnchorElement>("#race-back-link");
    this.presenter = new RacePlayerPresenter(this.root);
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
    this.presenter.setText("race-name", this.raceDocument.name);
    setupChromeAutoHide(this.root, signal);

    this.lifecycleHost = {
      raceDocument: this.raceDocument,
      stage: this.stage,
      layout: this.layout,
      finishSchedule: this.finishSchedule,
      progression: this.progression,
      cameraController: this.cameraController,
      presenter: this.presenter,
      countdown: this.countdown,
      root: this.root,
      getLegWindow: () => this.legWindow,
      setLegWindow: (window) => {
        this.legWindow = window;
      },
      setTransition: (transition) => {
        this.transition = transition;
      },
      setLegElapsedMs: (ms) => {
        this.legElapsedMs = ms;
      },
      setPlaybackPaused: (paused) => {
        this.playbackPaused = paused;
      },
      setStatusMessage: (message) => {
        this.statusMessage = message;
      },
      getRunningStatus: () => this.runningStatus,
      updateActiveParticipants: () => this.updateActiveParticipants(),
      updateInterface: () => this.updateInterface(),
    };
    this.transitionHost = {
      raceDocument: this.raceDocument,
      progression: this.progression,
      cameraController: this.cameraController,
      presenter: this.presenter,
      layout: this.layout,
      root: this.root,
      getLegWindow: () => this.legWindow,
      getTransition: () => this.transition,
      setTransition: (transition) => {
        this.transition = transition;
      },
      setLegElapsedMs: (ms) => {
        this.legElapsedMs = ms;
      },
      setStatusMessage: (message) => {
        this.statusMessage = message;
      },
      getRunningStatus: () => this.runningStatus,
      buildLeg: (index) => buildLeg(this.lifecycleHost, index),
      updateActiveParticipants: () => this.updateActiveParticipants(),
      updateInterface: () => this.updateInterface(),
    };

    try {
      startRace(this.lifecycleHost);
    } catch (error) {
      this.stage.dispose();
      throw error;
    }
  }

  fixedUpdate(deltaMs: number) {
    if (
      this.disposed ||
      this.countdown.active ||
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
      beginTransition(this.transitionHost, snapshot.eliminatedTeamIndex, "finished");
      return;
    }
    if (
      this.maximumLegDurationMs !== null &&
      this.legElapsedMs >= this.maximumLegDurationMs
    ) {
      beginTransition(
        this.transitionHost,
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
        releaseNextLeg(this.transitionHost);
      }
      if (!this.cameraController.gliding) {
        finalizeTransition(this.transitionHost);
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
      this.countdown.active ||
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
    teardownLegs(this.lifecycleHost);
    this.progression.restart();
    this.presenter.setText("race-eliminated", "");
    this.presenter.setText("race-winner", "");
    startRace(this.lifecycleHost);
  };

  skipOrContinue = () => {
    if (
      this.disposed ||
      this.countdown.active ||
      this.progression.snapshot.winnerIndex !== null
    ) {
      return;
    }
    if (this.transition) {
      // Jump-cut the scroll; `finalizeTransition` runs on the next update tick.
      this.cameraController.completeGlide();
      return;
    }
    beginTransition(
      this.transitionHost,
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
    this.countdown.clear();
    teardownLegs(this.lifecycleHost);
    this.stage.dispose();
  }

  private updateInterface() {
    if (this.disposed) {
      return;
    }
    const snapshot = this.legWindow?.current.controller?.snapshot;
    this.presenter.updateInterface({
      racePhase: snapshot?.phase ?? "ready",
      raceState: this.currentState,
      releasedCount: snapshot ? snapshot.releasedMarbles : null,
      finishedCount: snapshot ? snapshot.finishedMarbles : null,
      statusMessage: this.statusMessage,
      controls: {
        pauseButtons: this.pauseButtons,
        restartButtons: this.restartButtons,
        skipContinueButtons: this.skipContinueButtons,
        winnerDeclared: this.progression.snapshot.winnerIndex !== null,
        countdownActive: this.countdown.active,
        playbackPaused: this.playbackPaused,
      },
    });
  }

  private bindControls(signal: AbortSignal) {
    bindRacePlayerControls({
      signal,
      backLink: this.backLink,
      pauseButtons: this.pauseButtons,
      restartButtons: this.restartButtons,
      skipContinueButtons: this.skipContinueButtons,
      onPause: this.togglePause,
      onRestart: this.restart,
      onSkipContinue: this.skipOrContinue,
    });
  }

  private updateActiveParticipants() {
    this.presenter.updateActiveParticipants(
      this.root,
      this.raceDocument,
      this.progression.snapshot.activeParticipantIndices
    );
  }

  private get runningStatus() {
    const progression = this.progression.snapshot;
    return runningLegStatus({
      raceDocument: this.raceDocument,
      legIndex: progression.legIndex,
      activeTeamCount: progression.activeParticipantIndices.length,
      marblesPerTeam:
        this.finishSchedule[progression.legIndex]?.marblesPerTeam ??
        this.raceDocument.rules.marblesPerTeam,
      courseIssue: this.legWindow?.current.controller?.snapshot.courseIssue,
    });
  }

  private get currentState() {
    if (this.progression.snapshot.winnerIndex !== null) {
      return "complete";
    }
    if (this.transition !== null) {
      return "transition";
    }
    if (this.countdown.active) {
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
