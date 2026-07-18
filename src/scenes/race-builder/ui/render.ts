import {
  computeEraSchedule,
  type LegFinishPlan,
} from "../../../game/race/eraSchedule";
import {
  MARBLES_PER_TEAM_OPTIONS,
  MAX_RACE_PARTICIPANTS,
  createLocalId,
  isRacePlayable,
  renderLevelThumbnail,
  requiredLegCount,
  type RaceLegDocument,
} from "../../../races";
import { wireLegDragHandle } from "./dragReorder";
import type { RaceBuilderContext } from "./context";

export const fitNameInput = (nameInput: HTMLTextAreaElement | null) => {
  if (!nameInput) return;
  nameInput.style.height = "auto";
  nameInput.style.height = `${nameInput.scrollHeight}px`;
};

export const render = (context: RaceBuilderContext) => {
  const { ui, repository, signal } = context;
  const race = context.race;
  if (
    !race ||
    !ui.nameInput ||
    !ui.playLink ||
    !ui.marbleCount ||
    !ui.marblesMinus ||
    !ui.marblesPlus ||
    !ui.legCount ||
    !ui.setupSummaryPill ||
    !ui.setupWarning ||
    !ui.setupWarningText ||
    !ui.legList ||
    !ui.legTemplate ||
    !ui.addLegButton ||
    !ui.completeRaceButton
  ) {
    return;
  }
  if (document.activeElement !== ui.nameInput) ui.nameInput.value = race.name;
  fitNameInput(ui.nameInput);
  ui.marbleCount.value = `${race.participants.length}`;
  ui.marblesMinus.disabled = race.participants.length <= 2;
  ui.marblesPlus.disabled = race.participants.length >= MAX_RACE_PARTICIPANTS;
  const marblesPerTeam = race.rules.marblesPerTeam;
  if (ui.marblesPerTeamSlider && ui.marblesPerTeamOutput) {
    // Legacy races store 100, which sits between the 96 and 120 stops —
    // park the thumb at the nearest stop but show the true value until the
    // user moves the slider.
    const sliderIndex = MARBLES_PER_TEAM_OPTIONS.reduce(
      (best, option, index) =>
        Math.abs(option - marblesPerTeam) <
        Math.abs(MARBLES_PER_TEAM_OPTIONS[best] - marblesPerTeam)
          ? index
          : best,
      0
    );
    ui.marblesPerTeamSlider.value = `${sliderIndex}`;
    ui.marblesPerTeamOutput.value = `${marblesPerTeam}`;
  }
  const needed = requiredLegCount(race);
  const difference = needed - race.legs.length;
  ui.legCount.textContent = `${race.legs.length} / ${needed}`;
  ui.setupSummaryPill.textContent = `${race.participants.length} teams · ${marblesPerTeam} each`;
  const configured = difference === 0;
  ui.setupWarning.hidden = configured;
  ui.setupWarningText.textContent = configured
    ? ""
    : difference > 0
      ? `Add ${difference} ${difference === 1 ? "leg" : "legs"}`
      : `Remove ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "leg" : "legs"}`;
  ui.addLegButton.hidden = difference <= 0;
  ui.completeRaceButton.hidden = difference === 0;

  const playable = isRacePlayable(race);
  if (playable) {
    ui.playLink.href = `/race?race=${encodeURIComponent(race.id)}`;
    ui.playLink.removeAttribute("data-tooltip");
  } else {
    ui.playLink.removeAttribute("href");
    ui.playLink.dataset.tooltip =
      difference > 0
        ? `Add ${difference} ${difference === 1 ? "leg" : "legs"} to play`
        : `Remove ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "leg" : "legs"} to play`;
  }
  ui.playLink.setAttribute("aria-disabled", `${!playable}`);
  ui.playLink.classList.toggle("opacity-40", !playable);
  ui.playLink.classList.toggle("cursor-not-allowed", !playable);
  ui.playLink.classList.toggle("hover:transform-none", !playable);

  ui.legList.replaceChildren();
  let handleToFocus: HTMLButtonElement | null = null;
  const startingTeams = race.participants.length;
  // With a complete race the era schedule is deterministic, so thumbnails
  // can show each leg's true finish rack: era bay count plus X'd bays.
  let schedule: LegFinishPlan[] | null = null;
  if (race.legs.length === startingTeams - 1) {
    try {
      schedule = computeEraSchedule({
        participantCount: startingTeams,
        marblesPerTeam: race.rules.marblesPerTeam,
        legs: race.legs.map(({ level }) => ({
          width: level.size[0],
          wallThickness: level.settings.wallThickness,
        })),
      });
    } catch {
      schedule = null;
    }
  }
  race.legs.forEach((leg, index) => {
    const fragment = ui.legTemplate!.content.cloneNode(
      true
    ) as DocumentFragment;
    const item = fragment.querySelector<HTMLElement>("li");
    const number = fragment.querySelector<HTMLElement>("[data-leg-number]");
    const thumbnail = fragment.querySelector<HTMLCanvasElement>(
      "[data-leg-thumbnail]"
    );
    const duplicate = fragment.querySelector<HTMLButtonElement>(
      "[data-duplicate-leg]"
    );
    const remove =
      fragment.querySelector<HTMLButtonElement>("[data-delete-leg]");
    const edit = fragment.querySelector<HTMLAnchorElement>("[data-edit-leg]");
    const handle = fragment.querySelector<HTMLButtonElement>("[data-drag-leg]");
    if (
      !item ||
      !number ||
      !thumbnail ||
      !duplicate ||
      !remove ||
      !edit ||
      !handle
    )
      return;

    number.textContent = `${index + 1}`.padStart(2, "0");
    edit.href = context.editLegUrl(leg.id);
    edit.setAttribute("aria-label", `Edit “${leg.name}”`);
    handle.setAttribute(
      "aria-label",
      `Reorder “${leg.name}”, position ${index + 1} of ${race.legs.length}. Press arrow keys to move.`
    );
    if (leg.id === context.pendingFocusLegId) handleToFocus = handle;
    wireLegDragHandle({ handle, item, leg, context });
    duplicate.addEventListener(
      "click",
      () => {
        if (
          !context.race ||
          context.race.legs.length >= MAX_RACE_PARTICIPANTS - 1
        )
          return;
        const duplicateName = `${leg.name} copy`;
        const copy: RaceLegDocument = {
          ...structuredClone(leg),
          id: createLocalId(),
          name: duplicateName,
          level: { ...structuredClone(leg.level), name: duplicateName },
        };
        context.race = repository.addLeg(context.race.id, copy, index + 1);
        context.render();
      },
      { signal }
    );
    remove.addEventListener(
      "click",
      () => {
        if (!context.race || !window.confirm(`Delete “${leg.name}”?`)) return;
        context.race = repository.deleteLeg(context.race.id, leg.id);
        context.render();
      },
      { signal }
    );

    ui.legList!.append(fragment);
    // One team is eliminated per leg, so later legs race with fewer teams.
    const plan = schedule?.[index];
    renderLevelThumbnail(thumbnail, leg.level, {
      teamCount: plan ? plan.bayCount : startingTeams - index,
      xBayCount: plan?.xBayCount,
    });
  });
  context.pendingFocusLegId = null;
  (handleToFocus as HTMLButtonElement | null)?.focus();
};
