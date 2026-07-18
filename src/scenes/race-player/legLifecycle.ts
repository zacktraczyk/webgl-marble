import type Stage from "../../engine/stage";
import type { LegFinishPlan } from "../../game/race/eraSchedule";
import type { RoundConfiguration } from "../../game/level/types";
import { roundConfigurationFromFinishPlan } from "../../game/race/legRound";
import type { RaceDocument } from "../../races/types";
import { LegInstance } from "./legInstance";
import type { LegFrame } from "./legStack";
import type { RaceProgression } from "./progression";
import type { RaceCameraController } from "./raceCamera";
import type { RaceCountdown } from "./countdown";
import type { RacePlayerPresenter } from "./presenter";
import type { LegWindow, Transition } from "./transition";

/** Dependencies for opening, building, and tearing down leg windows. */
export type LegLifecycleHost = {
  raceDocument: RaceDocument;
  stage: Stage;
  layout: readonly LegFrame[];
  finishSchedule: readonly LegFinishPlan[];
  progression: RaceProgression;
  cameraController: RaceCameraController;
  presenter: RacePlayerPresenter;
  countdown: RaceCountdown;
  root: HTMLElement;
  getLegWindow: () => LegWindow | null;
  setLegWindow: (window: LegWindow | null) => void;
  setTransition: (transition: Transition | null) => void;
  setLegElapsedMs: (ms: number) => void;
  setPlaybackPaused: (paused: boolean) => void;
  setStatusMessage: (message: string) => void;
  getRunningStatus: () => string;
  updateActiveParticipants: () => void;
  updateInterface: () => void;
};

export const createRoundConfiguration = (
  host: Pick<LegLifecycleHost, "finishSchedule" | "raceDocument">,
  legIndex: number
): RoundConfiguration =>
  roundConfigurationFromFinishPlan(
    host.finishSchedule[legIndex],
    host.raceDocument.releaseIntervalMs
  );

export const buildLeg = (
  host: Pick<
    LegLifecycleHost,
    "stage" | "raceDocument" | "layout" | "finishSchedule"
  >,
  index: number
): LegInstance => {
  const leg = host.raceDocument.legs[index];
  return new LegInstance({
    stage: host.stage,
    leg,
    frame: host.layout[index],
    configuration: createRoundConfiguration(host, index),
  });
};

export const teardownLegs = (host: LegLifecycleHost) => {
  host.countdown.clear();
  host.setTransition(null);
  const legWindow = host.getLegWindow();
  if (legWindow) {
    legWindow.previous?.dispose();
    legWindow.current.dispose();
    legWindow.next?.dispose();
    host.setLegWindow(null);
  }
};

export const launchCurrentLeg = (host: LegLifecycleHost) => {
  host.getLegWindow()?.current.controller?.toggleRunning();
  host.setStatusMessage(host.getRunningStatus());
  host.updateInterface();
};

export const beginCountdown = (host: LegLifecycleHost) => {
  host.countdown.begin({
    root: host.root,
    onStatus: (message) => {
      host.setStatusMessage(message);
      host.updateInterface();
    },
    onComplete: () => launchCurrentLeg(host),
  });
};

export const startRace = (host: LegLifecycleHost) => {
  host.setTransition(null);
  host.setLegElapsedMs(0);
  host.setPlaybackPaused(false);

  const progression = host.progression.snapshot;
  const current = buildLeg(host, progression.legIndex);
  const nextIndex = progression.legIndex + 1;
  const next = host.layout[nextIndex] ? buildLeg(host, nextIndex) : null;
  current.attachController([...progression.activeParticipantIndices]);
  host.setLegWindow({ previous: null, current, next });

  host.cameraController.snapTo(current.worldRect);

  const leg = host.raceDocument.legs[progression.legIndex];
  host.root.dataset.legIndex = `${progression.legIndex}`;
  host.presenter.setText("race-leg-name", leg.name);
  host.presenter.setText(
    "race-leg-progress",
    `Leg ${progression.legIndex + 1} of ${host.raceDocument.legs.length}`
  );
  host.presenter.setText("race-eliminated", "");
  host.presenter.setText("race-winner", "");
  host.updateActiveParticipants();

  // Leg 0 always opens with the countdown; the stack is otherwise idle.
  beginCountdown(host);
};
