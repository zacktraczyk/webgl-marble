import {
  MARBLES_PER_TEAM_OPTIONS,
  MAX_RACE_PARTICIPANTS,
  createDefaultLeg,
  createDefaultParticipants,
  requiredLegCount,
} from "../../../races";
import { wireLegListReorder } from "./dragReorder";
import { fitNameInput, type RaceBuilderContext } from "./render";

/**
 * Binds every top-level race-builder control (name, marble counts, sliders,
 * add/complete leg, sticky legs header) once. Returns a dispose callback.
 */
export const bindRaceBuilderControls = (
  context: RaceBuilderContext
): (() => void) => {
  const { ui, repository, signal } = context;

  let stickyHeaderObserver: IntersectionObserver | null = null;
  if (ui.legsHeader && ui.legsDivider) {
    const legsHeader = ui.legsHeader;
    // The header is pinned exactly when the divider above it has scrolled
    // out of view (of the column scroller on lg, the viewport on mobile).
    stickyHeaderObserver = new IntersectionObserver(([entry]) => {
      const stuck = !entry.isIntersecting;
      legsHeader.classList.toggle("border-line", stuck);
      legsHeader.classList.toggle("border-transparent", !stuck);
    });
    stickyHeaderObserver.observe(ui.legsDivider);
  }

  const setParticipantCount = (nextCount: number) => {
    if (!context.race || nextCount < 2 || nextCount > MAX_RACE_PARTICIPANTS)
      return;
    const defaults = createDefaultParticipants(nextCount);
    context.saveRace({
      ...context.race,
      participants: defaults.map(
        (participant, index) => context.race!.participants[index] ?? participant
      ),
    });
  };

  ui.nameInput?.addEventListener("input", () => fitNameInput(ui.nameInput), {
    signal,
  });
  ui.nameInput?.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        ui.nameInput?.blur();
      }
    },
    { signal }
  );
  ui.nameInput?.addEventListener(
    "change",
    () => {
      if (!context.race || !ui.nameInput) return;
      const name = ui.nameInput.value.replace(/\s+/g, " ").trim();
      context.saveRace({ ...context.race, name: name || "Untitled race" });
    },
    { signal }
  );
  ui.marblesMinus?.addEventListener(
    "click",
    () =>
      context.race && setParticipantCount(context.race.participants.length - 1),
    { signal }
  );
  ui.marblesPlus?.addEventListener(
    "click",
    () =>
      context.race && setParticipantCount(context.race.participants.length + 1),
    { signal }
  );
  ui.marblesPerTeamSlider?.addEventListener(
    "input",
    () => {
      if (!ui.marblesPerTeamSlider || !ui.marblesPerTeamOutput) return;
      const option =
        MARBLES_PER_TEAM_OPTIONS[Number(ui.marblesPerTeamSlider.value)];
      if (option !== undefined) ui.marblesPerTeamOutput.value = `${option}`;
    },
    { signal }
  );
  ui.marblesPerTeamSlider?.addEventListener(
    "change",
    () => {
      if (!context.race || !ui.marblesPerTeamSlider) return;
      const option =
        MARBLES_PER_TEAM_OPTIONS[Number(ui.marblesPerTeamSlider.value)];
      if (option === undefined || option === context.race.rules.marblesPerTeam)
        return;
      context.saveRace({
        ...context.race,
        rules: { ...context.race.rules, marblesPerTeam: option },
      });
    },
    { signal }
  );
  ui.addLegButton?.addEventListener(
    "click",
    () => {
      if (
        !context.race ||
        context.race.legs.length >= requiredLegCount(context.race)
      )
        return;
      context.race = repository.addLeg(
        context.race.id,
        createDefaultLeg({ index: context.race.legs.length })
      );
      context.render();
    },
    { signal }
  );
  wireLegListReorder(context);
  ui.completeRaceButton?.addEventListener(
    "click",
    () => {
      if (!context.race) return;
      const needed = requiredLegCount(context.race);
      if (
        context.race.legs.length > needed &&
        !window.confirm(
          `Remove the final ${context.race.legs.length - needed} ${context.race.legs.length - needed === 1 ? "leg" : "legs"} to match the team count?`
        )
      ) {
        return;
      }
      const next = structuredClone(context.race);
      next.legs.splice(needed);
      while (next.legs.length < needed) {
        next.legs.push(createDefaultLeg({ index: next.legs.length }));
      }
      context.saveRace(next);
    },
    { signal }
  );

  return () => stickyHeaderObserver?.disconnect();
};
