import type { Entity } from "../../engine/core/entity";
import type { CollisionEvents } from "../../engine/physics/physics";
import type Stage from "../../engine/stage";
import { marbleDefinition } from "../../game/prefabs/marble";
import {
  createStagingMarblePlacements,
  fitStagingMarbleRadius,
  RoundRobinReleaseQueue,
  TEAM_COLORS,
} from "../../game/race/staging";
import {
  DEFAULT_SPAWN_DIRECTION_VARIANCE,
  randomSpawnAngle,
} from "../../game/race/spawn";
import type { AuthoredLevel } from "./authoredLevel";
import {
  MARBLE_RADIUS_STEP,
  MAX_MARBLE_RADIUS,
  MIN_MARBLE_RADIUS,
  STAGING_MARBLE_GAP,
  STAGING_MARBLE_PADDING,
} from "./constants";
import type { RacePhase, RoundConfiguration } from "./types";
import { createSeededRandom, hashString } from "./utils";

type StagedMarble = {
  entity: Entity;
  teamIndex: number;
};

export type RaceSnapshot = {
  phase: RacePhase;
  teamCount: number;
  totalMarbles: number;
  stagedMarbles: number;
  releasedMarbles: number;
  finishedMarbles: number;
  marbleRadius: number;
  stagingPhysicsActive: boolean;
  lostMarbles: number;
  courseIssue: string | null;
};

export class RaceController {
  private configuration: RoundConfiguration;
  private phase: RacePhase = "ready";
  private raceMarbles: Entity[] = [];
  private stagedMarbles: StagedMarble[] = [];
  private releaseQueue: RoundRobinReleaseQueue<StagedMarble> | null = null;
  private stagingPhysicsActive = false;
  private marbleRadius = MAX_MARBLE_RADIUS;
  private releaseElapsedMs = 0;
  private releasedMarbles = 0;
  private finishedMarbles = 0;
  private motionElapsedMs = 0;
  private readonly stagingPreviewCache = new Map<
    string,
    ReturnType<typeof createStagingMarblePlacements>
  >();

  constructor(
    private readonly stage: Stage,
    private readonly level: AuthoredLevel,
    configuration: RoundConfiguration
  ) {
    this.configuration = { ...configuration };
    this.stage.registerPhysicsObserver(this.handleCollisions);
  }

  setConfiguration(configuration: RoundConfiguration) {
    this.configuration = { ...configuration };
    this.level.setTeamCount(configuration.teamCount);
    this.reset();
  }

  get snapshot(): RaceSnapshot {
    const totalMarbles =
      this.configuration.teamCount * this.configuration.marblesPerTeam;
    const stagedMarbles = this.releaseQueue?.remaining ?? 0;
    const lostMarbles =
      this.raceMarbles.filter(
        (marble) => marble.markedForDeletion && !marble.hasTag("staged-marble")
      ).length - this.finishedMarbles;

    return {
      phase: this.phase,
      teamCount: this.configuration.teamCount,
      totalMarbles,
      stagedMarbles,
      releasedMarbles: this.releasedMarbles,
      finishedMarbles: this.finishedMarbles,
      marbleRadius: this.marbleRadius,
      stagingPhysicsActive: this.stagingPhysicsActive,
      lostMarbles: Math.max(0, lostMarbles),
      courseIssue: this.courseIssue,
    };
  }

  get courseIssue() {
    if (!this.level.has("staging-rack")) {
      return "Place a staging rack to run the race";
    }
    if (!this.level.has("spawn-point")) {
      return "Place a spawn point to run the race";
    }
    if (!this.level.has("finish-zone")) {
      return "The course needs a finish line";
    }
    return null;
  }

  toggleRunning() {
    if (this.courseIssue) {
      return;
    }
    if (this.phase === "running") {
      this.phase = "paused";
      return;
    }
    if (this.phase === "complete") {
      this.reset();
    }
    this.activateStagingPhysics();
    this.phase = "running";
    this.releaseElapsedMs = this.configuration.releaseIntervalMs;
  }

  reset() {
    this.phase = "ready";
    this.stage.physicsEnabled = false;
    this.releaseElapsedMs = 0;
    this.releasedMarbles = 0;
    this.finishedMarbles = 0;
    this.motionElapsedMs = 0;
    this.clearRaceMarbles();
    this.level.resetMotion();

    const rack = this.level.find("staging-rack");
    if (!rack) {
      this.marbleRadius = MAX_MARBLE_RADIUS;
      return;
    }
    this.level.refresh(rack);
    this.stage.world.flushDestruction();

    const teamQueues = Array.from(
      { length: this.configuration.teamCount },
      (): StagedMarble[] => []
    );
    this.marbleRadius = fitStagingMarbleRadius({
      position: rack.transform.position,
      ...rack.properties,
      teamCount: this.configuration.teamCount,
      marblesPerTeam: this.configuration.marblesPerTeam,
      maximumRadius: MAX_MARBLE_RADIUS,
      minimumRadius: MIN_MARBLE_RADIUS,
      radiusStep: MARBLE_RADIUS_STEP,
      gap: STAGING_MARBLE_GAP,
      padding: STAGING_MARBLE_PADDING,
    });

    for (const placement of this.getFrozenStagingPlacements(rack)) {
      const marble = this.stage.spawn(
        marbleDefinition({
          position: placement.position,
          radius: this.marbleRadius,
          color: TEAM_COLORS[placement.teamIndex],
          team: `${placement.teamIndex + 1}`,
          tags: ["race-marble", "staged-marble"],
          physical: false,
        })
      );
      this.raceMarbles.push(marble);
      const stagedMarble = { entity: marble, teamIndex: placement.teamIndex };
      this.stagedMarbles.push(stagedMarble);
      teamQueues[placement.teamIndex].push(stagedMarble);
    }
    this.releaseQueue = new RoundRobinReleaseQueue(teamQueues);
  }

  fixedUpdate(deltaMs: number) {
    if (this.phase === "running") {
      this.level.prepareMotionStep(this.motionElapsedMs, deltaMs);
      this.releaseElapsedMs += deltaMs;
      if (this.releaseElapsedMs >= this.configuration.releaseIntervalMs) {
        if (this.releaseNextMarble()) {
          this.releaseElapsedMs = 0;
        }
      }
    }

    if (this.phase !== "paused" && this.phase !== "complete") {
      this.stage.update(deltaMs);
      this.stage.clearOutOfBoundsObjects();
    }

    if (this.phase === "running") {
      this.motionElapsedMs += deltaMs;
    }

    if (
      this.phase === "running" &&
      this.releaseQueue?.remaining === 0 &&
      this.raceMarbles.every((marble) => marble.markedForDeletion)
    ) {
      this.phase = "complete";
    }
  }

  dispose() {
    this.stage.unregisterPhysicsObserver(this.handleCollisions);
  }

  private clearRaceMarbles() {
    for (const marble of this.raceMarbles) {
      marble.delete();
    }
    this.raceMarbles = [];
    this.stagedMarbles = [];
    this.releaseQueue = null;
    this.stagingPhysicsActive = false;
    this.stage.world.flushDestruction();
  }

  private getFrozenStagingPlacements(
    rack: NonNullable<ReturnType<AuthoredLevel["find"]>>
  ) {
    if (rack.prefab !== "staging-rack") {
      throw new Error("Staging placements require a staging rack");
    }
    const cacheKey = [
      ...rack.transform.position,
      rack.properties.width,
      rack.properties.height,
      rack.properties.wallThickness,
      this.configuration.teamCount,
      this.configuration.marblesPerTeam,
      this.marbleRadius,
      STAGING_MARBLE_GAP,
    ].join(":");
    const cachedPlacements = this.stagingPreviewCache.get(cacheKey);
    if (cachedPlacements) {
      return cachedPlacements;
    }
    const placements = createStagingMarblePlacements({
      position: rack.transform.position,
      ...rack.properties,
      teamCount: this.configuration.teamCount,
      marblesPerTeam: this.configuration.marblesPerTeam,
      marbleRadius: this.marbleRadius,
      gap: STAGING_MARBLE_GAP,
      padding: STAGING_MARBLE_PADDING,
      distribution: "stacked",
      random: createSeededRandom(hashString(cacheKey)),
    });
    this.stagingPreviewCache.set(cacheKey, placements);
    return placements;
  }

  private activateStagingPhysics() {
    if (this.stagingPhysicsActive) {
      return;
    }
    const dynamicRaceMarbles: Entity[] = [];
    for (const stagedMarble of this.stagedMarbles) {
      const previewMarble = stagedMarble.entity;
      const dynamicMarble = this.stage.spawn(
        marbleDefinition({
          position: [...previewMarble.position],
          radius: this.marbleRadius,
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
    this.raceMarbles = dynamicRaceMarbles;
    this.stage.world.flushDestruction();
    this.stagingPhysicsActive = true;
    this.stage.physicsEnabled = true;
  }

  private getSpawnPoint() {
    return this.level.find("spawn-point");
  }

  private isSpawnPointClear() {
    const spawnPoint = this.getSpawnPoint();
    if (!spawnPoint) {
      return false;
    }
    const minimumDistance = this.marbleRadius * 2.5;
    return !this.raceMarbles.some((marble) => {
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
  }

  private releaseNextMarble() {
    if (!this.releaseQueue || !this.isSpawnPointClear()) {
      return false;
    }
    const stagedMarble = this.releaseQueue.takeNext();
    const spawnPoint = this.getSpawnPoint();
    if (!stagedMarble || !spawnPoint) {
      return false;
    }

    const angle = randomSpawnAngle(
      spawnPoint.transform.rotation ?? 0,
      spawnPoint.properties.directionVariance ??
        DEFAULT_SPAWN_DIRECTION_VARIANCE
    );
    const marble = stagedMarble.entity;
    const physicsMarble = this.stage.getPhysicsEntity(marble);
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
    this.releasedMarbles++;
    return true;
  }

  private readonly handleCollisions = ({
    entityCollisions,
  }: CollisionEvents) => {
    for (const { entity1: firstId, entity2: secondId } of entityCollisions) {
      for (const [marbleId, finishId] of [
        [firstId, secondId],
        [secondId, firstId],
      ]) {
        const marble = this.stage.world.get(marbleId);
        const finish = this.stage.world.get(finishId);
        if (
          marble?.hasTag("released-marble") &&
          finish?.hasTag("finish-zone")
        ) {
          marble.delete();
          this.finishedMarbles++;
          break;
        }
      }
    }
  };
}
