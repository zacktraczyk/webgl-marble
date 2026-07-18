import { attachTooltip } from "../components/tooltip";
import type { Scene } from "../engine/runtime/scene";
import {
  computeEraSchedule,
  type LegFinishPlan,
} from "../game/race/eraSchedule";
import {
  MARBLES_PER_TEAM_OPTIONS,
  MAX_RACE_PARTICIPANTS,
  RaceRepository,
  createDefaultLeg,
  createDefaultParticipants,
  createLocalId,
  isRacePlayable,
  renderLevelThumbnail,
  requiredLegCount,
  type RaceDocument,
  type RaceLegDocument,
} from "../races";

function initializeRaceBuilder(signal: AbortSignal) {
  attachTooltip(document.body, signal);
  const repository = new RaceRepository();
  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race") ?? "";
  let race: RaceDocument | null = repository.get(raceId);

  const missing = document.querySelector<HTMLElement>("#missing-race");
  const builder = document.querySelector<HTMLElement>("#race-builder");
  const nameInput = document.querySelector<HTMLTextAreaElement>("#race-name");
  const playLink = document.querySelector<HTMLAnchorElement>("#play-race");
  const marbleCount =
    document.querySelector<HTMLOutputElement>("#marble-count");
  const marblesMinus =
    document.querySelector<HTMLButtonElement>("#marbles-minus");
  const marblesPlus =
    document.querySelector<HTMLButtonElement>("#marbles-plus");
  const setupSummary = document.querySelector<HTMLElement>("#setup-summary");
  const marblesPerTeamSlider =
    document.querySelector<HTMLInputElement>("#marbles-per-team");
  const marblesPerTeamOutput = document.querySelector<HTMLOutputElement>(
    "#marbles-per-team-output"
  );
  const releaseSpeed =
    document.querySelector<HTMLInputElement>("#release-speed");
  const releaseSpeedOutput = document.querySelector<HTMLOutputElement>(
    "#release-speed-output"
  );
  const legCount = document.querySelector<HTMLElement>("#leg-count");
  const legGuidance = document.querySelector<HTMLElement>("#leg-guidance");
  const legList = document.querySelector<HTMLOListElement>("#leg-list");
  const legTemplate =
    document.querySelector<HTMLTemplateElement>("#leg-template");
  const addLegButton = document.querySelector<HTMLButtonElement>("#add-leg");
  const completeRaceButton =
    document.querySelector<HTMLButtonElement>("#complete-race");
  const legMoveStatus = document.querySelector<HTMLElement>("#leg-move-status");

  let draggedItem: HTMLElement | null = null;
  let pendingFocusLegId: string | null = null;
  let stickyHeaderObserver: IntersectionObserver | null = null;

  const editLegUrl = (legId: string) =>
    `/leg-builder?race=${encodeURIComponent(raceId)}&leg=${encodeURIComponent(legId)}`;

  const saveRace = (next: RaceDocument) => {
    race = repository.save(next);
    render();
  };

  const fitNameInput = () => {
    if (!nameInput) return;
    nameInput.style.height = "auto";
    nameInput.style.height = `${nameInput.scrollHeight}px`;
  };

  const render = () => {
    if (
      !race ||
      !nameInput ||
      !playLink ||
      !marbleCount ||
      !marblesMinus ||
      !marblesPlus ||
      !releaseSpeed ||
      !releaseSpeedOutput ||
      !legCount ||
      !legGuidance ||
      !legList ||
      !legTemplate ||
      !addLegButton ||
      !completeRaceButton
    ) {
      return;
    }
    if (document.activeElement !== nameInput) nameInput.value = race.name;
    fitNameInput();
    marbleCount.value = `${race.participants.length}`;
    marblesMinus.disabled = race.participants.length <= 2;
    marblesPlus.disabled = race.participants.length >= MAX_RACE_PARTICIPANTS;
    const marblesPerTeam = race.rules.marblesPerTeam;
    if (setupSummary) {
      setupSummary.textContent = `${marblesPerTeam} marbles each to start · losers' marbles carry over`;
    }
    if (marblesPerTeamSlider && marblesPerTeamOutput) {
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
      marblesPerTeamSlider.value = `${sliderIndex}`;
      marblesPerTeamOutput.value = `${marblesPerTeam}`;
    }
    releaseSpeed.value = `${race.releaseIntervalMs}`;
    releaseSpeedOutput.value = `${race.releaseIntervalMs} ms`;

    const needed = requiredLegCount(race);
    const difference = needed - race.legs.length;
    legCount.textContent = `${race.legs.length} / ${needed}`;
    legGuidance.textContent =
      difference === 0
        ? "Ready to play"
        : difference > 0
          ? `Add ${difference} ${difference === 1 ? "leg" : "legs"}`
          : `Remove ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "leg" : "legs"}`;
    legGuidance.className = `text-xs font-semibold ${difference === 0 ? "text-green-400" : "text-red-400"}`;
    addLegButton.hidden = difference <= 0;
    completeRaceButton.hidden = difference === 0;

    const playable = isRacePlayable(race);
    if (playable) {
      playLink.href = `/race?race=${encodeURIComponent(race.id)}`;
      playLink.removeAttribute("data-tooltip");
    } else {
      playLink.removeAttribute("href");
      playLink.dataset.tooltip =
        difference > 0
          ? `Add ${difference} ${difference === 1 ? "leg" : "legs"} to play`
          : `Remove ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "leg" : "legs"} to play`;
    }
    playLink.setAttribute("aria-disabled", `${!playable}`);
    playLink.classList.toggle("opacity-40", !playable);
    playLink.classList.toggle("cursor-not-allowed", !playable);
    playLink.classList.toggle("hover:transform-none", !playable);

    legList.replaceChildren();
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
      const fragment = legTemplate.content.cloneNode(true) as DocumentFragment;
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
      const handle =
        fragment.querySelector<HTMLButtonElement>("[data-drag-leg]");
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
      edit.href = editLegUrl(leg.id);
      edit.setAttribute("aria-label", `Edit “${leg.name}”`);
      handle.setAttribute(
        "aria-label",
        `Reorder “${leg.name}”, position ${index + 1} of ${race!.legs.length}. Press arrow keys to move.`
      );
      if (leg.id === pendingFocusLegId) handleToFocus = handle;
      handle.addEventListener(
        "keydown",
        (event) => {
          const offset =
            event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          if (!offset || !race) return;
          event.preventDefault();
          const from = race.legs.findIndex(
            (candidate) => candidate.id === leg.id
          );
          const to = from + offset;
          if (from < 0 || to < 0 || to >= race.legs.length) return;
          race = repository.moveLeg(race.id, leg.id, to);
          pendingFocusLegId = leg.id;
          if (legMoveStatus) {
            legMoveStatus.textContent = `“${leg.name}” moved to position ${to + 1} of ${race.legs.length}.`;
          }
          render();
        },
        { signal }
      );
      handle.addEventListener(
        "dragstart",
        (event) => {
          if (!event.dataTransfer) return;
          draggedItem = item;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", leg.id);
          const rect = item.getBoundingClientRect();
          event.dataTransfer.setDragImage(
            item,
            event.clientX - rect.left,
            event.clientY - rect.top
          );
          // Fade after the browser captures the drag image, not before.
          requestAnimationFrame(() => item.classList.add("opacity-40"));
        },
        { signal }
      );
      handle.addEventListener(
        "dragend",
        (event) => {
          draggedItem = null;
          item.classList.remove("opacity-40");
          if (!race) return;
          const to = Array.from(legList.children).indexOf(item);
          const from = race.legs.findIndex(
            (candidate) => candidate.id === leg.id
          );
          if (
            event.dataTransfer?.dropEffect !== "none" &&
            to >= 0 &&
            to !== from
          ) {
            race = repository.moveLeg(race.id, leg.id, to);
          }
          // Re-render even when nothing moved to undo live preview reordering.
          render();
        },
        { signal }
      );
      duplicate.addEventListener(
        "click",
        () => {
          if (!race || race.legs.length >= MAX_RACE_PARTICIPANTS - 1) return;
          const duplicateName = `${leg.name} copy`;
          const copy: RaceLegDocument = {
            ...structuredClone(leg),
            id: createLocalId(),
            name: duplicateName,
            level: { ...structuredClone(leg.level), name: duplicateName },
          };
          race = repository.addLeg(race.id, copy, index + 1);
          render();
        },
        { signal }
      );
      remove.addEventListener(
        "click",
        () => {
          if (!race || !window.confirm(`Delete “${leg.name}”?`)) return;
          race = repository.deleteLeg(race.id, leg.id);
          render();
        },
        { signal }
      );

      legList.append(fragment);
      // One team is eliminated per leg, so later legs race with fewer teams.
      const plan = schedule?.[index];
      renderLevelThumbnail(thumbnail, leg.level, {
        teamCount: plan ? plan.bayCount : startingTeams - index,
        xBayCount: plan?.xBayCount,
      });
    });
    pendingFocusLegId = null;
    (handleToFocus as HTMLButtonElement | null)?.focus();
  };

  const setParticipantCount = (nextCount: number) => {
    if (!race || nextCount < 2 || nextCount > MAX_RACE_PARTICIPANTS) return;
    const defaults = createDefaultParticipants(nextCount);
    saveRace({
      ...race,
      participants: defaults.map(
        (participant, index) => race!.participants[index] ?? participant
      ),
    });
  };

  if (!race) {
    if (missing) missing.hidden = false;
    if (playLink) playLink.hidden = true;
  } else {
    if (builder) builder.hidden = false;
    const legsHeader = document.querySelector<HTMLElement>("#legs-header");
    const legsDivider = document.querySelector<HTMLElement>("#legs-divider");
    if (legsHeader && legsDivider) {
      // The header is pinned exactly when the divider above it has scrolled
      // out of view (of the column scroller on lg, the viewport on mobile).
      stickyHeaderObserver = new IntersectionObserver(([entry]) => {
        const stuck = !entry.isIntersecting;
        legsHeader.classList.toggle("border-line", stuck);
        legsHeader.classList.toggle("border-transparent", !stuck);
      });
      stickyHeaderObserver.observe(legsDivider);
    }
    nameInput?.addEventListener("input", fitNameInput, { signal });
    nameInput?.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nameInput.blur();
        }
      },
      { signal }
    );
    nameInput?.addEventListener(
      "change",
      () => {
        if (!race || !nameInput) return;
        const name = nameInput.value.replace(/\s+/g, " ").trim();
        saveRace({ ...race, name: name || "Untitled race" });
      },
      { signal }
    );
    marblesMinus?.addEventListener(
      "click",
      () => race && setParticipantCount(race.participants.length - 1),
      { signal }
    );
    marblesPlus?.addEventListener(
      "click",
      () => race && setParticipantCount(race.participants.length + 1),
      { signal }
    );
    marblesPerTeamSlider?.addEventListener(
      "input",
      () => {
        if (!marblesPerTeamSlider || !marblesPerTeamOutput) return;
        const option =
          MARBLES_PER_TEAM_OPTIONS[Number(marblesPerTeamSlider.value)];
        if (option !== undefined) marblesPerTeamOutput.value = `${option}`;
      },
      { signal }
    );
    marblesPerTeamSlider?.addEventListener(
      "change",
      () => {
        if (!race || !marblesPerTeamSlider) return;
        const option =
          MARBLES_PER_TEAM_OPTIONS[Number(marblesPerTeamSlider.value)];
        if (option === undefined || option === race.rules.marblesPerTeam)
          return;
        saveRace({
          ...race,
          rules: { ...race.rules, marblesPerTeam: option },
        });
      },
      { signal }
    );
    releaseSpeed?.addEventListener(
      "input",
      () => {
        if (releaseSpeedOutput && releaseSpeed)
          releaseSpeedOutput.value = `${releaseSpeed.value} ms`;
      },
      { signal }
    );
    releaseSpeed?.addEventListener(
      "change",
      () => {
        if (!race || !releaseSpeed) return;
        saveRace({ ...race, releaseIntervalMs: Number(releaseSpeed.value) });
      },
      { signal }
    );
    addLegButton?.addEventListener(
      "click",
      () => {
        if (!race || race.legs.length >= requiredLegCount(race)) return;
        race = repository.addLeg(
          race.id,
          createDefaultLeg({ index: race.legs.length })
        );
        render();
      },
      { signal }
    );
    legList?.addEventListener(
      "dragover",
      (event) => {
        if (!draggedItem || !legList) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        const nextSibling = Array.from(legList.children)
          .filter(
            (child): child is HTMLElement =>
              child instanceof HTMLElement && child !== draggedItem
          )
          .find((child) => {
            const rect = child.getBoundingClientRect();
            return event.clientY < rect.top + rect.height / 2;
          });
        if ((nextSibling ?? null) === draggedItem.nextElementSibling) return;
        legList.insertBefore(draggedItem, nextSibling ?? null);
        legList
          .querySelectorAll("[data-leg-number]")
          .forEach((numberBadge, position) => {
            numberBadge.textContent = `${position + 1}`.padStart(2, "0");
          });
      },
      { signal }
    );
    legList?.addEventListener("drop", (event) => event.preventDefault(), {
      signal,
    });
    completeRaceButton?.addEventListener(
      "click",
      () => {
        if (!race) return;
        const needed = requiredLegCount(race);
        if (
          race.legs.length > needed &&
          !window.confirm(
            `Remove the final ${race.legs.length - needed} ${race.legs.length - needed === 1 ? "leg" : "legs"} to match the team count?`
          )
        ) {
          return;
        }
        const next = structuredClone(race);
        next.legs.splice(needed);
        while (next.legs.length < needed) {
          next.legs.push(createDefaultLeg({ index: next.legs.length }));
        }
        saveRace(next);
      },
      { signal }
    );
    render();
  }

  return () => stickyHeaderObserver?.disconnect();
}

export default function createScene(): Scene {
  let dispose = () => {};

  return {
    load: ({ signal }) => {
      dispose = initializeRaceBuilder(signal);
    },
    dispose: () => dispose(),
  };
}
