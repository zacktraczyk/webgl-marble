import type { RaceDocument } from "../../races/types";
import type { RaceCameraController } from "./raceCamera";
import type { LegInstance } from "./legInstance";
import type { LegFrame } from "./legStack";
import type { RaceProgression } from "./progression";
import type { RacePlayerPresenter } from "./presenter";
import {
  type EliminationReason,
  type LegWindow,
  type Transition,
} from "./transition";

/** Mutable transition/window state owned by the race-player runtime. */
export type TransitionHost = {
  raceDocument: RaceDocument;
  progression: RaceProgression;
  cameraController: RaceCameraController;
  presenter: RacePlayerPresenter;
  layout: readonly LegFrame[];
  root: HTMLElement;
  getLegWindow: () => LegWindow | null;
  getTransition: () => Transition | null;
  setTransition: (transition: Transition | null) => void;
  setLegElapsedMs: (ms: number) => void;
  setStatusMessage: (message: string) => void;
  getRunningStatus: () => string;
  buildLeg: (index: number) => LegInstance;
  updateActiveParticipants: () => void;
  updateInterface: () => void;
};

export const beginTransition = (
  host: TransitionHost,
  eliminatedStableIndex: number,
  reason: EliminationReason
) => {
  const legWindow = host.getLegWindow();
  if (
    legWindow === null ||
    host.getTransition() !== null ||
    host.progression.snapshot.winnerIndex !== null ||
    !host.progression.snapshot.activeParticipantIndices.includes(
      eliminatedStableIndex
    )
  ) {
    return;
  }

  // On a skip/timeout the leg has no natural survivor yet — freeze whatever is
  // still live into the finish pool so its colors are still drainable above.
  if (reason !== "finished") {
    legWindow.current.controller?.abandon();
  }

  const oldLeg = legWindow.current;
  const result = host.progression.eliminate(eliminatedStableIndex);
  host.updateActiveParticipants();

  if (result.winnerIndex !== null) {
    const winner = host.raceDocument.participants[result.winnerIndex];
    host.setStatusMessage(`${winner.name} wins ${host.raceDocument.name}!`);
    host.presenter.setText("race-winner", winner.name);
    host.presenter.setText("race-eliminated", "");
    // Camera stays on the final leg; the frozen field is the end tableau.
    host.updateInterface();
    return;
  }

  const nextLeg = legWindow.next;
  if (!nextLeg) {
    // A non-winning elimination always has a leg to scroll to; guard anyway.
    return;
  }

  const participant = host.raceDocument.participants[eliminatedStableIndex];
  host.setStatusMessage(
    reason === "timed-out"
      ? `Leg timed out — ${participant.name} team is eliminated.`
      : reason === "skipped"
        ? `Leg skipped — ${participant.name} team is eliminated.`
        : `${participant.name} has the final marble on the track and is eliminated.`
  );
  host.presenter.setText("race-eliminated", participant.name);

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

  host.cameraController.glideTo(nextLeg.worldRect);
  host.setTransition({ released: false, oldLeg });
  host.updateInterface();
};

export const releaseNextLeg = (host: TransitionHost) => {
  host.getLegWindow()?.next?.controller?.toggleRunning();
  const transition = host.getTransition();
  if (transition) {
    transition.released = true;
  }
};

export const finalizeTransition = (host: TransitionHost) => {
  const legWindow = host.getLegWindow();
  const transition = host.getTransition();
  if (legWindow === null || transition === null) {
    return;
  }
  const nextLeg = legWindow.next;
  if (!nextLeg) {
    return;
  }

  // If the scroll finished before the 2/3 hand-off fired, release now.
  if (!transition.released) {
    releaseNextLeg(host);
  }
  const oldLeg = transition.oldLeg;
  host.setTransition(null);

  // Slide the window down one leg and pre-build the following leg's geometry.
  legWindow.previous = oldLeg;
  legWindow.current = nextLeg;
  const legIndex = host.progression.snapshot.legIndex;
  const followingIndex = legIndex + 1;
  legWindow.next = host.layout[followingIndex]
    ? host.buildLeg(followingIndex)
    : null;

  host.setLegElapsedMs(0);

  const leg = host.raceDocument.legs[legIndex];
  host.root.dataset.legIndex = `${legIndex}`;
  host.presenter.setText("race-leg-name", leg.name);
  host.presenter.setText(
    "race-leg-progress",
    `Leg ${legIndex + 1} of ${host.raceDocument.legs.length}`
  );
  host.presenter.setText("race-eliminated", "");
  host.setStatusMessage(host.getRunningStatus());

  // Drop the just-finished leg immediately if it has already scrolled fully
  // out of view; otherwise it lingers (still ticking motion) until the next
  // transition retires it.
  if (host.cameraController.visibleFractionOf(oldLeg.worldRect) === 0) {
    oldLeg.dispose();
    legWindow.previous = null;
  }

  host.updateInterface();
};
