import type { Scene } from "../../engine/runtime/scene";
import {
  captureEvent,
  EVENTS,
  legAnalyticsProperties,
  raceAnalyticsProperties,
} from "../../lib/analytics";
import { attachTooltip } from "../../ui/tooltip";
import {
  isRacePlayable,
  RaceRepository,
  type RaceDocument,
} from "../../raceLibrary";
import { bindRaceBuilderControls } from "./ui/controls";
import type { RaceBuilderContext, RaceBuilderEvent } from "./ui/context";
import { resolveRaceBuilderUi } from "./ui/elements";
import { render } from "./ui/render";
import { legBuilderUrl } from "../urls";

/** Thin orchestrator: wires the repository, resolved UI, render, and controls. */
function createRaceBuilder(signal: AbortSignal) {
  attachTooltip(document.body, signal);
  const repository = new RaceRepository();
  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race") ?? "";
  const ui = resolveRaceBuilderUi();
  const initialRace = repository.get(raceId);
  let setupCompletedCaptured = initialRace
    ? isRacePlayable(initialRace)
    : false;

  const editLegUrl = (legId: string) => legBuilderUrl(raceId, legId);
  const captureSetupCompleted = (race: RaceDocument) => {
    if (setupCompletedCaptured || !isRacePlayable(race)) return;
    setupCompletedCaptured = true;
    captureEvent(EVENTS.RACE_SETUP_COMPLETED, raceAnalyticsProperties(race));
  };
  const onEvent = (event: RaceBuilderEvent) => {
    if (event.type === "leg_created") {
      captureEvent(EVENTS.LEG_CREATED, {
        ...legAnalyticsProperties(event.race, event.legNumber),
        creation_source: event.creationSource,
      });
    }
    captureSetupCompleted(event.race);
  };

  const context: RaceBuilderContext = {
    ui,
    repository,
    raceId,
    signal,
    race: initialRace,
    draggedItem: null,
    pendingFocusLegId: null,
    onEvent,
    render: () => render(context),
    saveRace: (next: RaceDocument) => {
      context.race = repository.save(next);
      onEvent({ type: "race_updated", race: context.race });
      context.render();
    },
    editLegUrl,
  };

  let disposeControls = () => {};

  if (!context.race) {
    captureEvent(EVENTS.OPERATION_FAILED, {
      surface: "race_builder",
      operation: "load_race_builder",
      reason: "not_found",
    });
    if (ui.missing) ui.missing.hidden = false;
    if (ui.playLink) ui.playLink.hidden = true;
  } else {
    if (ui.builder) ui.builder.hidden = false;
    disposeControls = bindRaceBuilderControls(context);
    render(context);
  }

  return disposeControls;
}

export default function createScene(): Scene {
  let dispose = () => {};

  return {
    load: ({ signal }) => {
      dispose = createRaceBuilder(signal);
    },
    dispose: () => dispose(),
  };
}
