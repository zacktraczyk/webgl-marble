import { attachTooltip } from "../../ui/tooltip";
import { RaceRepository, type RaceDocument } from "../../races";
import { bindRaceBuilderControls } from "./ui/controls";
import type { RaceBuilderContext } from "./ui/context";
import { resolveRaceBuilderUi } from "./ui/elements";
import { render } from "./ui/render";

/** Thin orchestrator: wires the repository, resolved UI, render, and controls. */
export function createRaceBuilder(signal: AbortSignal) {
  attachTooltip(document.body, signal);
  const repository = new RaceRepository();
  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race") ?? "";
  const ui = resolveRaceBuilderUi();

  const editLegUrl = (legId: string) =>
    `/leg-builder?race=${encodeURIComponent(raceId)}&leg=${encodeURIComponent(legId)}`;

  const context: RaceBuilderContext = {
    ui,
    repository,
    raceId,
    signal,
    race: repository.get(raceId),
    draggedItem: null,
    pendingFocusLegId: null,
    render: () => render(context),
    saveRace: (next: RaceDocument) => {
      context.race = repository.save(next);
      context.render();
    },
    editLegUrl,
  };

  let disposeControls = () => {};

  if (!context.race) {
    if (ui.missing) ui.missing.hidden = false;
    if (ui.playLink) ui.playLink.hidden = true;
  } else {
    if (ui.builder) ui.builder.hidden = false;
    disposeControls = bindRaceBuilderControls(context);
    render(context);
  }

  return disposeControls;
}
