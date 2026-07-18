import { RaceRepository, isRacePlayable, type RaceDocument } from "../../races";
import { mountScene } from "../mount";
import createRacePlayerScene from "./index";

const showError = (
  title: string,
  copy: string,
  actionHref = "/",
  actionLabel = "Return to library"
) => {
  const errorState = document.querySelector<HTMLElement>("#race-error-state");
  const errorTitle = document.querySelector<HTMLElement>("#race-error-title");
  const errorCopy = document.querySelector<HTMLElement>("#race-error-copy");
  const errorAction =
    document.querySelector<HTMLAnchorElement>("#race-error-action");
  if (errorState) errorState.hidden = false;
  if (errorTitle) errorTitle.textContent = title;
  if (errorCopy) errorCopy.textContent = copy;
  if (errorAction) {
    errorAction.href = actionHref;
    errorAction.textContent = actionLabel;
  }
};

const resolveRace = (): RaceDocument | null => {
  const raceId = new URLSearchParams(window.location.search).get("race") ?? "";
  return new RaceRepository().get(raceId);
};

/** Validates the race query and mounts the player, or shows an error state. */
export const bootRacePlayerPage = () => {
  const race = resolveRace();
  const player = document.querySelector<HTMLElement>("#race-player");

  if (!race) {
    showError("Race not found", "It may have been deleted from this browser.");
    return;
  }
  if (!isRacePlayable(race)) {
    showError(
      "Race setup is incomplete",
      "A race needs exactly one leg for each team that will be eliminated.",
      `/race-builder?race=${encodeURIComponent(race.id)}`,
      "Open race builder"
    );
    return;
  }
  if (!player) {
    return;
  }

  const backLink =
    document.querySelector<HTMLAnchorElement>("#race-back-link");
  if (backLink) {
    backLink.href = `/race-builder?race=${encodeURIComponent(race.id)}`;
  }
  player.hidden = false;
  try {
    mountScene(createRacePlayerScene(race, player), {
      errorElement: document.querySelector<HTMLElement>("#race-error"),
    });
  } catch (error) {
    showError("Race could not start", `${error}`);
    player.hidden = true;
  }
};
