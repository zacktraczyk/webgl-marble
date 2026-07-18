import type { Scene, SceneContext } from "../../engine/runtime/scene";
import { createLegRoundConfiguration } from "../../game/race/legRound";
import { RaceRepository } from "../../races";
import createLevelBuilder from "./createLevelBuilder";

const byId = (id: string) => document.getElementById(id);

const setupSidebar = () => {
  const builder = byId("leg-builder");
  const sidebar = byId("leg-options-sidebar");
  const sidebarToggle = byId("toggle-sidebar");
  const openSidebarIcon = sidebarToggle?.querySelector<SVGElement>(
    '[data-sidebar-icon="open"]'
  );
  const closeSidebarIcon = sidebarToggle?.querySelector<SVGElement>(
    '[data-sidebar-icon="close"]'
  );

  const setSidebarOpen = (open: boolean) => {
    if (!builder || !sidebar || !sidebarToggle) {
      return;
    }

    builder.dataset.sidebarOpen = `${open}`;
    sidebarToggle.setAttribute("aria-expanded", `${open}`);
    sidebarToggle.setAttribute(
      "aria-label",
      open ? "Close options sidebar" : "Open options sidebar"
    );
    sidebarToggle.dataset.tooltip = open ? "Close Sidebar" : "Open Sidebar";
    sidebar.setAttribute("aria-hidden", `${!open}`);
    sidebar.toggleAttribute("inert", !open);
    openSidebarIcon?.classList.toggle("hidden", open);
    closeSidebarIcon?.classList.toggle("hidden", !open);
  };

  const onSidebarToggle = () => {
    setSidebarOpen(builder?.dataset.sidebarOpen !== "true");
  };
  sidebarToggle?.addEventListener("click", onSidebarToggle);

  return () => {
    sidebarToggle?.removeEventListener("click", onSidebarToggle);
  };
};

const wireRaceHomeLink = () => {
  const builder = byId("leg-builder");
  const homeLink = byId("builder-home-link") as HTMLAnchorElement | null;
  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race");
  const legId = params.get("leg");
  const repository = new RaceRepository();
  const race = raceId ? repository.get(raceId) : null;
  const raceLeg = race?.legs.find((leg) => leg.id === legId) ?? null;

  if (race && raceLeg && homeLink) {
    homeLink.href = `/race-builder?race=${encodeURIComponent(race.id)}`;
    const label = homeLink.querySelector("span");
    if (label) {
      label.textContent = "Race builder";
    }
    for (const role of ["team-count", "marbles-per-team", "release-interval"]) {
      const input = builder?.querySelector<HTMLInputElement>(
        `[data-role="${role}"]`
      );
      if (input) {
        input.disabled = true;
        input.title = "This setting is controlled by the race builder";
      }
    }
  }

  const legIndex = race?.legs.findIndex((leg) => leg.id === legId) ?? -1;
  const roundConfiguration =
    race && raceLeg
      ? createLegRoundConfiguration(
          {
            participantCount: race.participants.length,
            marblesPerTeam: race.rules.marblesPerTeam,
            releaseIntervalMs: race.releaseIntervalMs,
            legs: race.legs.map((leg) => ({
              width: leg.level.size[0],
              wallThickness: leg.level.settings.wallThickness,
            })),
          },
          Math.max(legIndex, 0)
        )
      : null;

  return {
    builder,
    race,
    raceLeg,
    repository,
    roundConfiguration,
  };
};

/** Page scene for `/leg-builder` — wires race persistence around the level editor. */
export default function createScene(): Scene {
  let disposeChrome = () => {};
  let inner: Scene | null = null;

  return {
    load: (context: SceneContext) => {
      disposeChrome = setupSidebar();
      const { builder, race, raceLeg, repository, roundConfiguration } =
        wireRaceHomeLink();

      let currentRace = race;
      let currentLeg = raceLeg;

      inner = createLevelBuilder(builder, {
        ...(currentRace && currentLeg && roundConfiguration
          ? {
              initialLevel: currentLeg.level,
              roundConfiguration,
              onCommit: (level) => {
                if (!currentRace || !currentLeg) {
                  return;
                }
                currentLeg = {
                  ...currentLeg,
                  level: { ...level, name: currentLeg.name },
                };
                currentRace = repository.saveLeg(currentRace.id, currentLeg);
              },
            }
          : {}),
      });
      inner.load?.(context);
    },
    fixedUpdate: (deltaMs) => inner?.fixedUpdate?.(deltaMs),
    update: (deltaMs, interpolation) => inner?.update?.(deltaMs, interpolation),
    render: (interpolation) => inner?.render?.(interpolation),
    dispose: () => {
      inner?.dispose?.();
      inner = null;
      disposeChrome();
    },
  };
}
