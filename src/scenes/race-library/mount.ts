import {
  RaceRepository,
  createDefaultRace,
  isRacePlayable,
  renderLevelThumbnail,
  requiredLegCount,
} from "../../races";
import { attachTooltip } from "../../ui/tooltip";

/** Boots the race library grid on `/`. */
export const mountRaceLibrary = () => {
  attachTooltip(document.body);
  const repository = new RaceRepository();
  const grid = document.querySelector<HTMLElement>("#grid");
  const template = document.querySelector<HTMLTemplateElement>("#tile");
  const createTile = document.querySelector<HTMLElement>("#create-tile");

  const builderUrl = (raceId: string) =>
    `/race-builder?race=${encodeURIComponent(raceId)}`;

  const createRace = () => {
    const race = repository.create(createDefaultRace());
    window.location.assign(builderUrl(race.id));
  };

  const renderLibrary = () => {
    if (!grid || !template || !createTile) return;
    const races = repository.list();
    grid.replaceChildren();

    const pending: (() => void)[] = [];
    for (const race of races) {
      const fragment = template.content.cloneNode(true) as DocumentFragment;
      const playable = isRacePlayable(race);
      fragment.querySelector<HTMLAnchorElement>("a")!.href = builderUrl(
        race.id
      );
      fragment.querySelector("[data-name]")!.textContent = race.name;
      fragment.querySelector("[data-legs]")!.textContent =
        `${race.legs.length} ${race.legs.length === 1 ? "leg" : "legs"}`;

      const preview = fragment.querySelector<HTMLElement>("[data-preview]")!;
      const strip = document.createElement("div");
      strip.className = "flex flex-col gap-1.5";
      preview.append(strip);
      const canvases = race.legs.map((leg) => {
        const canvas = document.createElement("canvas");
        canvas.className = "block w-full rounded-lg";
        canvas.style.aspectRatio = `${leg.level.size[0]} / ${leg.level.size[1]}`;
        strip.append(canvas);
        return canvas;
      });
      // Draw after the cards are in the document so sizes are measurable.
      pending.push(() => {
        race.legs.forEach((leg, index) => {
          renderLevelThumbnail(canvases[index], leg.level, {
            background: "oklch(19% 0.004 285)",
            courseBackground: "oklch(26% 0.005 285)",
            border: "oklch(38% 0.006 285)",
            teamCount: race.participants.length - index,
          });
        });
      });

      fragment
        .querySelector<HTMLButtonElement>("[data-duplicate-race]")!
        .addEventListener("click", () => {
          repository.duplicateRace(race.id);
          renderLibrary();
        });
      fragment
        .querySelector<HTMLButtonElement>("[data-delete-race]")!
        .addEventListener("click", () => {
          if (!confirm(`Delete "${race.name}"? This can't be undone.`)) return;
          repository.delete(race.id);
          renderLibrary();
        });

      const action = fragment.querySelector<HTMLElement>("[data-action]")!;
      action.textContent = playable ? "Preview" : "Finish setup";
      action.classList.add(playable ? "pill-play" : "pill-primary");
      if (!playable) {
        const difference = requiredLegCount(race) - race.legs.length;
        action.dataset.tooltip =
          difference > 0
            ? `Add ${difference} ${difference === 1 ? "leg" : "legs"} to play`
            : `Remove ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "leg" : "legs"} to play`;
      }
      grid.append(fragment);
    }
    grid.append(createTile);
    for (const draw of pending) draw();
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-create-race]"
  )) {
    button.addEventListener("click", createRace);
  }
  renderLibrary();
};
