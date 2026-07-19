import { RaceRepository, isRacePlayable, type RaceDocument } from "../../races";
import { showPageErrorState } from "../../ui/pageError";
import { mountScene } from "../mount";
import createRacePlayerScene from "./index";

const resolveRace = (): RaceDocument | null => {
  const raceId = new URLSearchParams(window.location.search).get("race") ?? "";
  return new RaceRepository().get(raceId);
};

/** Validates the race query and mounts the player, or shows an error state. */
export const bootRacePlayer = () => {
  const race = resolveRace();
  const player = document.querySelector<HTMLElement>("#race-player");

  if (!race) {
    showPageErrorState({
      title: "Race not found",
      copy: "It may have been deleted from this browser.",
    });
    return;
  }
  if (!isRacePlayable(race)) {
    showPageErrorState({
      title: "Race setup is incomplete",
      copy: "A race needs exactly one leg for each team that will be eliminated.",
      action: {
        href: `/race-builder?race=${encodeURIComponent(race.id)}`,
        label: "Open race builder",
      },
    });
    return;
  }
  if (!player) {
    return;
  }

  const backLinks = document.querySelectorAll<HTMLAnchorElement>(
    "[data-race-back-link]"
  );
  for (const backLink of backLinks) {
    backLink.href = `/race-builder?race=${encodeURIComponent(race.id)}`;
  }
  player.hidden = false;
  try {
    mountScene(createRacePlayerScene(race, player), {
      errorElement: document.querySelector<HTMLElement>("#race-error"),
    });
  } catch (error) {
    showPageErrorState({
      title: "Race could not start",
      copy: `${error}`,
    });
    player.hidden = true;
  }
};
