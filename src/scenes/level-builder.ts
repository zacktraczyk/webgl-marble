import {
  LevelDocument,
  type NewLevelObjectData,
} from "../editor/levelDocument";
import type { Entity } from "../engine/core/entity";
import type { Vec2 } from "../engine/core/transform";
import type { Scene } from "../engine/runtime/scene";
import Stage from "../engine/stage";
import { levelObjectDefinitions } from "../game/prefabs/levelObject";
import { marbleDefinition } from "../game/prefabs/marble";
import {
  STAGING_RACK_HEIGHT,
  STAGING_RACK_WALL_THICKNESS,
  STAGING_RACK_WIDTH,
} from "../game/prefabs/stagingRack";
import {
  createStagingMarblePlacements,
  fitStagingMarbleRadius,
  MAX_TEAMS,
  RoundRobinReleaseQueue,
  TEAM_COLORS,
} from "../game/race/staging";

type BuilderElements = {
  pan: HTMLElement | null;
  pointer: HTMLElement | null;
  wall: HTMLElement | null;
  bumper: HTMLElement | null;
  stagingRack: HTMLElement | null;
  spawnPoint: HTMLElement | null;
  play: HTMLElement | null;
  reset: HTMLElement | null;
  teamCount: HTMLElement | null;
  teamCountOutput: HTMLElement | null;
  marblesPerTeam: HTMLElement | null;
  marblesPerTeamOutput: HTMLElement | null;
  releaseInterval: HTMLElement | null;
  releaseIntervalOutput: HTMLElement | null;
  status: HTMLElement | null;
  debugInfo: HTMLElement | null;
};

enum SelectedTool {
  Pan,
  Pointer,
  Wall,
  Bumper,
  StagingRack,
  SpawnPoint,
}

type RacePhase = "ready" | "running" | "paused" | "complete";

type RoundConfiguration = {
  teamCount: number;
  marblesPerTeam: number;
  releaseIntervalMs: number;
};

type StagedMarble = {
  entity: Entity;
  teamIndex: number;
};

const STAGE_WIDTH = 1200;
const STAGE_HEIGHT = 800;
const GRID_SIZE = 25;
const MAX_MARBLE_RADIUS = 8;
const STAGING_MARBLE_GAP = 1;
const FINISH_LINE_HEIGHT = 24;
const DEFAULT_LAUNCH_SPEED = 70;
const WALL_COLOR = [113 / 255, 113 / 255, 122 / 255, 1] as const;
const FINISH_COLOR = [239 / 255, 68 / 255, 68 / 255, 1] as const;
const SPAWN_COLOR = [34 / 255, 211 / 255, 238 / 255, 1] as const;

const requireElement = <T extends HTMLElement>(
  element: HTMLElement | null,
  label: string
) => {
  if (!element) {
    throw new Error(`Level builder element not found: ${label}`);
  }
  return element as T;
};

const clampInteger = (value: string, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || minimum));

const snapToGrid = ([x, y]: Vec2): Vec2 => [
  Math.round(x / GRID_SIZE) * GRID_SIZE,
  Math.round(y / GRID_SIZE) * GRID_SIZE,
];

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
};

function createScene(elementSelectors: BuilderElements): Scene {
  let runtime: ReturnType<typeof init>;

  return {
    load: ({ signal }) => {
      runtime = init(elementSelectors, signal);
    },
    fixedUpdate: (deltaMs) => runtime.fixedUpdate(deltaMs),
    update: () => runtime.updateInterface(),
    render: () => runtime.stage.render(),
    dispose: () => runtime.stage.dispose(),
  };
}

function init(selectors: BuilderElements, signal: AbortSignal) {
  const panButton = requireElement<HTMLButtonElement>(
    selectors.pan,
    "pan tool"
  );
  const pointerButton = requireElement<HTMLButtonElement>(
    selectors.pointer,
    "pointer tool"
  );
  const wallButton = requireElement<HTMLButtonElement>(
    selectors.wall,
    "wall tool"
  );
  const bumperButton = requireElement<HTMLButtonElement>(
    selectors.bumper,
    "bumper tool"
  );
  const stagingRackButton = requireElement<HTMLButtonElement>(
    selectors.stagingRack,
    "staging rack tool"
  );
  const spawnPointButton = requireElement<HTMLButtonElement>(
    selectors.spawnPoint,
    "spawn point tool"
  );
  const playButton = requireElement<HTMLButtonElement>(selectors.play, "play");
  const resetButton = requireElement<HTMLButtonElement>(
    selectors.reset,
    "reset"
  );
  const teamCountInput = requireElement<HTMLInputElement>(
    selectors.teamCount,
    "team count"
  );
  const teamCountOutput = requireElement<HTMLOutputElement>(
    selectors.teamCountOutput,
    "team count output"
  );
  const marblesPerTeamInput = requireElement<HTMLInputElement>(
    selectors.marblesPerTeam,
    "marbles per team"
  );
  const marblesPerTeamOutput = requireElement<HTMLOutputElement>(
    selectors.marblesPerTeamOutput,
    "marbles per team output"
  );
  const releaseIntervalInput = requireElement<HTMLInputElement>(
    selectors.releaseInterval,
    "release interval"
  );
  const releaseIntervalOutput = requireElement<HTMLOutputElement>(
    selectors.releaseIntervalOutput,
    "release interval output"
  );
  const statusOutput = requireElement<HTMLElement>(selectors.status, "status");
  const debugInfo = requireElement<HTMLElement>(
    selectors.debugInfo,
    "debug info"
  );

  const stage = new Stage({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
  stage.centerCameraOnResize = true;
  stage.fitStageToWindowOnResizePadding = 64;
  stage.fitStageToWindowOnResize = true;
  stage.fitStageToWindow(64);

  const levelDocument = new LevelDocument("Untitled level", [
    stage.width,
    stage.height,
  ]);
  const authoredEntities = new Map<string, Entity[]>();
  let selectedTool = SelectedTool.Pointer;
  let phase: RacePhase = "ready";
  let roundConfiguration: RoundConfiguration;
  let raceMarbles: Entity[] = [];
  let stagedMarbles: StagedMarble[] = [];
  let releaseQueue: RoundRobinReleaseQueue<StagedMarble> | null = null;
  let stagingPhysicsActive = false;
  let marbleRadius = MAX_MARBLE_RADIUS;
  let releaseElapsedMs = 0;
  let releasedMarbles = 0;
  let finishedMarbles = 0;
  const stagingPreviewCache = new Map<
    string,
    ReturnType<typeof createStagingMarblePlacements>
  >();

  const readRoundConfiguration = (): RoundConfiguration => ({
    teamCount: clampInteger(teamCountInput.value, 1, MAX_TEAMS),
    marblesPerTeam: clampInteger(marblesPerTeamInput.value, 1, 100),
    releaseIntervalMs: clampInteger(releaseIntervalInput.value, 50, 1000),
  });
  roundConfiguration = readRoundConfiguration();

  const setActiveTool = (tool: SelectedTool, button: HTMLButtonElement) => {
    selectedTool = tool;
    for (const toolButton of [
      panButton,
      pointerButton,
      wallButton,
      bumperButton,
      stagingRackButton,
      spawnPointButton,
    ]) {
      toolButton.dataset.active = toolButton === button ? "true" : "false";
    }
    stage.panAndZoom = tool === SelectedTool.Pan;
    stage.canvas.dataset.pointer =
      tool === SelectedTool.Pan
        ? "pan"
        : tool === SelectedTool.Pointer
          ? "select"
          : "shape";
  };

  const spawnAuthoredObject = (
    object: (typeof levelDocument.objects)[number]
  ) => {
    const entities = levelObjectDefinitions(object, {
      teamCount: roundConfiguration.teamCount,
    }).map((definition) => stage.spawn(definition));
    authoredEntities.set(object.id, entities);
    return object;
  };

  const addAuthoredObject = (data: NewLevelObjectData) =>
    spawnAuthoredObject(levelDocument.add(data));

  const removeAuthoredObject = (id: string) => {
    for (const entity of authoredEntities.get(id) ?? []) {
      entity.delete();
    }
    authoredEntities.delete(id);
    levelDocument.remove(id);
  };

  const replaceUniqueObject = (
    prefab: "staging-rack" | "spawn-point",
    data: NewLevelObjectData
  ) => {
    const current = levelDocument.objects.find(
      (object) => object.prefab === prefab
    );
    if (current) {
      removeAuthoredObject(current.id);
    }
    return addAuthoredObject(data);
  };

  const respawnRackParts = () => {
    const rack = levelDocument.objects.find(
      (object) => object.prefab === "staging-rack"
    );
    if (!rack) {
      return;
    }
    for (const entity of authoredEntities.get(rack.id) ?? []) {
      entity.delete();
    }
    spawnAuthoredObject(rack);
  };

  const clearRaceMarbles = () => {
    for (const marble of raceMarbles) {
      marble.delete();
    }
    raceMarbles = [];
    stagedMarbles = [];
    releaseQueue = null;
    stagingPhysicsActive = false;
    stage.world.flushDestruction();
  };

  const getFrozenStagingPlacements = (
    rack: Extract<
      (typeof levelDocument.objects)[number],
      { prefab: "staging-rack" }
    >
  ) => {
    const cacheKey = [
      ...rack.transform.position,
      rack.properties.width,
      rack.properties.height,
      rack.properties.wallThickness,
      roundConfiguration.teamCount,
      roundConfiguration.marblesPerTeam,
      marbleRadius,
      STAGING_MARBLE_GAP,
    ].join(":");
    const cachedPlacements = stagingPreviewCache.get(cacheKey);
    if (cachedPlacements) {
      return cachedPlacements;
    }
    const placements = createStagingMarblePlacements({
      position: rack.transform.position,
      ...rack.properties,
      teamCount: roundConfiguration.teamCount,
      marblesPerTeam: roundConfiguration.marblesPerTeam,
      marbleRadius,
      gap: STAGING_MARBLE_GAP,
      distribution: "stacked",
      random: createSeededRandom(hashString(cacheKey)),
    });
    stagingPreviewCache.set(cacheKey, placements);
    return placements;
  };

  const resetRace = () => {
    phase = "ready";
    stage.physicsEnabled = false;
    releaseElapsedMs = 0;
    releasedMarbles = 0;
    finishedMarbles = 0;
    clearRaceMarbles();
    respawnRackParts();
    stage.world.flushDestruction();

    const rack = levelDocument.objects.find(
      (object) => object.prefab === "staging-rack"
    );
    if (!rack || rack.prefab !== "staging-rack") {
      throw new Error("The level requires a staging rack");
    }

    const teamQueues = Array.from(
      { length: roundConfiguration.teamCount },
      (): StagedMarble[] => []
    );
    marbleRadius = fitStagingMarbleRadius({
      position: rack.transform.position,
      ...rack.properties,
      teamCount: roundConfiguration.teamCount,
      marblesPerTeam: roundConfiguration.marblesPerTeam,
      gap: STAGING_MARBLE_GAP,
    });
    const placements = getFrozenStagingPlacements(rack);

    for (const placement of placements) {
      const marble = stage.spawn(
        marbleDefinition({
          position: placement.position,
          radius: marbleRadius,
          color: TEAM_COLORS[placement.teamIndex],
          team: `${placement.teamIndex + 1}`,
          tags: ["race-marble", "staged-marble"],
          physical: false,
        })
      );
      raceMarbles.push(marble);
      const stagedMarble = {
        entity: marble,
        teamIndex: placement.teamIndex,
      };
      stagedMarbles.push(stagedMarble);
      teamQueues[placement.teamIndex].push(stagedMarble);
    }
    releaseQueue = new RoundRobinReleaseQueue(teamQueues);
  };

  const activateStagingPhysics = () => {
    if (stagingPhysicsActive) {
      return;
    }
    const dynamicRaceMarbles: Entity[] = [];
    for (const stagedMarble of stagedMarbles) {
      const previewMarble = stagedMarble.entity;
      const dynamicMarble = stage.spawn(
        marbleDefinition({
          position: [...previewMarble.position],
          radius: marbleRadius,
          color: TEAM_COLORS[stagedMarble.teamIndex],
          team: `${stagedMarble.teamIndex + 1}`,
          tags: ["race-marble", "staged-marble"],
          restitution: 0.15,
          friction: 0.55,
        })
      );
      previewMarble.delete();
      stagedMarble.entity = dynamicMarble;
      dynamicRaceMarbles.push(dynamicMarble);
    }
    raceMarbles = dynamicRaceMarbles;
    stage.world.flushDestruction();
    stagingPhysicsActive = true;
    stage.physicsEnabled = true;
  };

  const placeUniqueCourseObject = (
    prefab: "staging-rack" | "spawn-point",
    position: Vec2
  ) => {
    if (prefab === "staging-rack") {
      replaceUniqueObject(prefab, {
        prefab,
        transform: { position },
        properties: {
          width: STAGING_RACK_WIDTH,
          height: STAGING_RACK_HEIGHT,
          wallThickness: STAGING_RACK_WALL_THICKNESS,
          color: [...WALL_COLOR],
        },
      });
    } else {
      replaceUniqueObject(prefab, {
        prefab,
        transform: { position, rotation: Math.PI / 2 },
        properties: {
          radius: MAX_MARBLE_RADIUS * 2.5,
          color: [...SPAWN_COLOR],
          launchSpeed: DEFAULT_LAUNCH_SPEED,
        },
      });
    }
    resetRace();
  };

  const getSpawnPoint = () => {
    const spawnPoint = levelDocument.objects.find(
      (object) => object.prefab === "spawn-point"
    );
    if (!spawnPoint || spawnPoint.prefab !== "spawn-point") {
      throw new Error("The level requires a spawn point");
    }
    return spawnPoint;
  };

  const isSpawnPointClear = () => {
    const spawnPoint = getSpawnPoint();
    const minimumDistance = marbleRadius * 2.5;
    return !raceMarbles.some((marble) => {
      if (!marble.hasTag("released-marble") || marble.markedForDeletion) {
        return false;
      }
      return (
        Math.hypot(
          marble.position[0] - spawnPoint.transform.position[0],
          marble.position[1] - spawnPoint.transform.position[1]
        ) < minimumDistance
      );
    });
  };

  const releaseNextMarble = () => {
    if (!releaseQueue || !isSpawnPointClear()) {
      return false;
    }
    const stagedMarble = releaseQueue.takeNext();
    if (!stagedMarble) {
      return false;
    }
    const spawnPoint = getSpawnPoint();
    const angle = spawnPoint.transform.rotation ?? 0;
    const marble = stagedMarble.entity;
    const physicsMarble = stage.getPhysicsEntity(marble);
    if (!physicsMarble) {
      throw new Error("A staged marble must be physical before release");
    }
    marble.position = [...spawnPoint.transform.position];
    marble.tags.delete("staged-marble");
    marble.tags.add("released-marble");
    physicsMarble.velocity = [
      Math.cos(angle) * spawnPoint.properties.launchSpeed,
      Math.sin(angle) * spawnPoint.properties.launchSpeed,
    ];
    physicsMarble.angularVelocity = 0;
    releasedMarbles++;
    return true;
  };

  addAuthoredObject({
    prefab: "finish-zone",
    transform: {
      position: [0, stage.height / 2 - FINISH_LINE_HEIGHT / 2],
    },
    properties: {
      width: stage.width,
      height: FINISH_LINE_HEIGHT,
      color: [...FINISH_COLOR],
    },
  });
  addAuthoredObject({
    prefab: "staging-rack",
    transform: { position: [0, -250] },
    properties: {
      width: STAGING_RACK_WIDTH,
      height: STAGING_RACK_HEIGHT,
      wallThickness: STAGING_RACK_WALL_THICKNESS,
      color: [...WALL_COLOR],
    },
  });
  addAuthoredObject({
    prefab: "spawn-point",
    transform: { position: [0, -75], rotation: Math.PI / 2 },
    properties: {
      radius: MAX_MARBLE_RADIUS * 2.5,
      color: [...SPAWN_COLOR],
      launchSpeed: DEFAULT_LAUNCH_SPEED,
    },
  });

  stage.registerPhysicsObserver(({ entityCollisions }) => {
    for (const { entity1: firstId, entity2: secondId } of entityCollisions) {
      for (const [marbleId, finishId] of [
        [firstId, secondId],
        [secondId, firstId],
      ]) {
        const marble = stage.world.get(marbleId);
        const finish = stage.world.get(finishId);
        if (
          marble?.hasTag("released-marble") &&
          finish?.hasTag("finish-zone")
        ) {
          marble.delete();
          finishedMarbles++;
          break;
        }
      }
    }
  });

  const toolBindings: Array<[HTMLButtonElement, SelectedTool]> = [
    [panButton, SelectedTool.Pan],
    [pointerButton, SelectedTool.Pointer],
    [wallButton, SelectedTool.Wall],
    [bumperButton, SelectedTool.Bumper],
    [stagingRackButton, SelectedTool.StagingRack],
    [spawnPointButton, SelectedTool.SpawnPoint],
  ];
  for (const [button, tool] of toolBindings) {
    button.addEventListener("click", () => setActiveTool(tool, button), {
      signal,
    });
  }
  setActiveTool(SelectedTool.Pointer, pointerButton);

  stage.canvas.addEventListener(
    "click",
    (event) => {
      if (
        selectedTool === SelectedTool.Pan ||
        selectedTool === SelectedTool.Pointer
      ) {
        return;
      }
      const position = snapToGrid([
        ...stage.screenToWorld(
          event.clientX - stage.canvas.getBoundingClientRect().left,
          event.clientY - stage.canvas.getBoundingClientRect().top
        ),
      ] as Vec2);

      switch (selectedTool) {
        case SelectedTool.Wall:
          addAuthoredObject({
            prefab: "wall",
            transform: { position },
            properties: {
              width: 150,
              height: 25,
              color: [...WALL_COLOR],
            },
          });
          break;
        case SelectedTool.Bumper:
          addAuthoredObject({
            prefab: "bumper",
            transform: { position },
            properties: {
              radius: 22,
              color: [168 / 255, 85 / 255, 247 / 255, 1],
            },
          });
          break;
        case SelectedTool.StagingRack:
          placeUniqueCourseObject("staging-rack", position);
          break;
        case SelectedTool.SpawnPoint:
          placeUniqueCourseObject("spawn-point", position);
          break;
      }
    },
    { signal }
  );

  const handleRoundConfigurationChange = () => {
    roundConfiguration = readRoundConfiguration();
    resetRace();
  };
  teamCountInput.addEventListener("input", handleRoundConfigurationChange, {
    signal,
  });
  marblesPerTeamInput.addEventListener(
    "input",
    handleRoundConfigurationChange,
    { signal }
  );
  releaseIntervalInput.addEventListener(
    "input",
    handleRoundConfigurationChange,
    { signal }
  );

  playButton.addEventListener(
    "click",
    () => {
      if (phase === "running") {
        phase = "paused";
        return;
      }
      if (phase === "complete") {
        resetRace();
      }
      activateStagingPhysics();
      phase = "running";
      releaseElapsedMs = roundConfiguration.releaseIntervalMs;
    },
    { signal }
  );
  resetButton.addEventListener("click", resetRace, { signal });

  resetRace();

  const fixedUpdate = (deltaMs: number) => {
    if (phase === "running") {
      releaseElapsedMs += deltaMs;
      if (releaseElapsedMs >= roundConfiguration.releaseIntervalMs) {
        if (releaseNextMarble()) {
          releaseElapsedMs = 0;
        }
      }
    }

    if (phase !== "paused" && phase !== "complete") {
      stage.update(deltaMs);
      stage.clearOutOfBoundsObjects();
    }

    if (
      phase === "running" &&
      releaseQueue?.remaining === 0 &&
      raceMarbles.every((marble) => marble.markedForDeletion)
    ) {
      phase = "complete";
    }
  };

  const updateInterface = () => {
    const totalMarbles =
      roundConfiguration.teamCount * roundConfiguration.marblesPerTeam;
    const stagedMarbles = releaseQueue?.remaining ?? 0;
    const lostMarbles =
      raceMarbles.filter(
        (marble) => marble.markedForDeletion && !marble.hasTag("staged-marble")
      ).length - finishedMarbles;

    teamCountOutput.value = `${roundConfiguration.teamCount}`;
    marblesPerTeamOutput.value = `${roundConfiguration.marblesPerTeam}`;
    releaseIntervalOutput.value = `${roundConfiguration.releaseIntervalMs} ms`;
    playButton.textContent =
      phase === "running"
        ? "Pause"
        : phase === "paused"
          ? "Resume"
          : phase === "complete"
            ? "Run again"
            : "Run race";
    statusOutput.textContent =
      phase === "ready"
        ? "Ready to race"
        : phase === "running" && stagedMarbles > 0
          ? `Releasing ${totalMarbles} marbles round-robin`
          : phase === "running"
            ? "All marbles released"
            : phase === "paused"
              ? "Race paused"
              : "Race complete";
    debugInfo.textContent = JSON.stringify(
      {
        phase,
        teams: roundConfiguration.teamCount,
        totalMarbles,
        stagedMarbles,
        releasedMarbles,
        finishedMarbles,
        marbleRadius,
        stagingPhysicsActive,
        lostMarbles: Math.max(0, lostMarbles),
        authoredObjects: levelDocument.objects.length,
      },
      null,
      2
    );
  };

  return { stage, fixedUpdate, updateInterface };
}

export default createScene;
