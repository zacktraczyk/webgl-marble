import type { Entity } from "../../../engine/core/entity";
import type { CollisionEvents } from "../../../engine/physics/physics";
import type Stage from "../../../engine/stage";
import { marbleDefinition } from "../../../game/prefabs/marble";
import {
  createFinishGridLayout,
  createFinishGridPlacements,
} from "../../../game/race/finishGrid";
import {
  RoundRobinReleaseQueue,
  TEAM_COLORS,
} from "../../../game/race/staging";
import {
  DEFAULT_SPAWN_DIRECTION_VARIANCE,
  randomSpawnAngle,
  randomSpawnOffsetsInCircle,
  spawnAreaRadius,
} from "../../../game/race/spawn";
import type { AuthoredLevel } from "../level";
import {
  MAX_MARBLE_RADIUS,
  MIN_MARBLE_RADIUS,
  STAGING_MARBLE_GAP,
} from "../constants";
import type { RacePhase, RoundConfiguration } from "../types";
import { RoundFinishTracker } from "./roundFinishTracker";

type PendingMarble = {
  teamIndex: number;
};

export type RaceSnapshot = {
  phase: RacePhase;
  teamCount: number;
  totalMarbles: number;
  queuedMarbles: number;
  releasedMarbles: number;
  finishedMarbles: number;
  remainingMarbles: number;
  eliminatedTeamIndex: number | null;
  marbleRadius: number;
  physicsActive: boolean;
  outOfBoundsMarbles: number;
  courseIssue: string | null;
};

export type RaceControllerOptions = {
  stableTeamIndices?: readonly number[];
};

const resolveStableTeamIndices = (
  teamCount: number,
  stableTeamIndices?: readonly number[]
) => {
  const indices =
    stableTeamIndices ?? Array.from({ length: teamCount }, (_, index) => index);
  if (indices.length !== teamCount) {
    throw new Error(
      `Stable team indices must include exactly ${teamCount} teams`
    );
  }

  const uniqueIndices = new Set<number>();
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= TEAM_COLORS.length) {
      throw new Error(`Unknown stable team index: ${index}`);
    }
    if (uniqueIndices.has(index)) {
      throw new Error(`Duplicate stable team index: ${index}`);
    }
    uniqueIndices.add(index);
  }
  return [...indices];
};

export class RaceController {
  private configuration: RoundConfiguration;
  private stableTeamIndices: number[];
  private readonly usesCustomStableTeamIndices: boolean;
  private phase: RacePhase = "ready";
  private raceMarbles: Entity[] = [];
  private finishMarbles: Entity[] = [];
  private releaseQueue: RoundRobinReleaseQueue<PendingMarble> | null = null;
  private physicsActive = false;
  private marbleRadius = MAX_MARBLE_RADIUS;
  private releaseElapsedMs = 0;
  private releasedMarbles = 0;
  private outOfBoundsMarbles = 0;
  private finishTracker: RoundFinishTracker;
  private motionElapsedMs = 0;
  private finishPlacements: ReturnType<typeof createFinishGridPlacements> = [];

  constructor(
    private readonly stage: Stage,
    private readonly level: AuthoredLevel,
    configuration: RoundConfiguration,
    { stableTeamIndices }: RaceControllerOptions = {}
  ) {
    this.configuration = { ...configuration };
    this.usesCustomStableTeamIndices = stableTeamIndices !== undefined;
    this.stableTeamIndices = resolveStableTeamIndices(
      configuration.teamCount,
      stableTeamIndices
    );
    this.finishTracker = new RoundFinishTracker(
      configuration.teamCount,
      configuration.marblesPerTeam
    );
    this.stage.registerPhysicsObserver(this.handleCollisions);
  }

  setConfiguration(configuration: RoundConfiguration) {
    this.stableTeamIndices = resolveStableTeamIndices(
      configuration.teamCount,
      this.usesCustomStableTeamIndices ? this.stableTeamIndices : undefined
    );
    this.configuration = { ...configuration };
    this.level.setRoundConfiguration(configuration);
    this.reset();
  }

  get snapshot(): RaceSnapshot {
    const queuedMarbles = this.releaseQueue?.remaining ?? 0;
    const eliminatedLocalTeamIndex = this.finishTracker.eliminatedTeamIndex;

    return {
      phase: this.phase,
      teamCount: this.configuration.teamCount,
      totalMarbles: this.finishTracker.totalMarbles,
      queuedMarbles,
      releasedMarbles: this.releasedMarbles,
      finishedMarbles: this.finishTracker.finishedMarbles,
      remainingMarbles: this.finishTracker.remainingMarbles,
      eliminatedTeamIndex:
        eliminatedLocalTeamIndex === null
          ? null
          : this.stableTeamIndices[eliminatedLocalTeamIndex],
      marbleRadius: this.marbleRadius,
      physicsActive: this.physicsActive,
      outOfBoundsMarbles: this.outOfBoundsMarbles,
      courseIssue: this.courseIssue,
    };
  }

  get courseIssue() {
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
    this.activatePhysics();
    this.phase = "running";
    this.releaseElapsedMs = this.configuration.releaseIntervalMs;
  }

  reset() {
    this.phase = "ready";
    this.stage.physicsEnabled = false;
    this.releaseElapsedMs = 0;
    this.releasedMarbles = 0;
    this.outOfBoundsMarbles = 0;
    this.finishTracker = new RoundFinishTracker(
      this.configuration.teamCount,
      this.configuration.marblesPerTeam
    );
    this.motionElapsedMs = 0;
    this.clearRaceMarbles();
    this.level.resetMotion();

    const finish = this.level.find("finish-zone");
    const finishBayCount = this.configuration.teamCount;
    this.finishPlacements = [];
    if (!finish) {
      this.marbleRadius = MAX_MARBLE_RADIUS;
    } else {
      this.marbleRadius = createFinishGridLayout({
        position: finish.transform.position,
        rotation: finish.transform.rotation,
        width: finish.properties.width,
        height: finish.properties.height,
        wallThickness: this.level.wallThickness,
        teamCount: finishBayCount,
        marblesPerTeam: this.configuration.marblesPerTeam,
        maximumRadius: MAX_MARBLE_RADIUS,
        minimumRadius: MIN_MARBLE_RADIUS,
        gap: STAGING_MARBLE_GAP,
      }).marbleRadius;
      this.finishPlacements = createFinishGridPlacements({
        position: finish.transform.position,
        rotation: finish.transform.rotation,
        width: finish.properties.width,
        height: finish.properties.height,
        wallThickness: this.level.wallThickness,
        teamCount: finishBayCount,
        marblesPerTeam: this.configuration.marblesPerTeam,
        gap: STAGING_MARBLE_GAP,
        maximumRadius: this.marbleRadius,
        minimumRadius: this.marbleRadius,
      });
    }
    this.level.setRaceMarbleRadius(this.marbleRadius);

    const teamQueues = Array.from(
      { length: this.configuration.teamCount },
      (_, teamIndex): PendingMarble[] =>
        Array.from({ length: this.configuration.marblesPerTeam }, () => ({
          teamIndex,
        }))
    );
    this.releaseQueue = new RoundRobinReleaseQueue(teamQueues);
  }

  fixedUpdate(deltaMs: number) {
    if (this.phase === "running") {
      this.level.prepareMotionStep(this.motionElapsedMs, deltaMs);
      this.releaseElapsedMs += deltaMs;
      while (
        this.releaseQueue?.remaining &&
        this.releaseElapsedMs >= this.configuration.releaseIntervalMs
      ) {
        this.releaseWave();
        this.releaseElapsedMs -= this.configuration.releaseIntervalMs;
      }
    }

    if (this.phase !== "paused" && this.phase !== "complete") {
      this.stage.update(deltaMs);
      this.recordOutOfBoundsMarbles(this.stage.clearOutOfBoundsEntities());
    }

    if (this.phase === "running") {
      this.motionElapsedMs += deltaMs;
    }

    this.freezeIfLastMarbleRemains();
  }

  dispose() {
    this.stage.unregisterPhysicsObserver(this.handleCollisions);
  }

  private clearRaceMarbles() {
    for (const marble of [...this.raceMarbles, ...this.finishMarbles]) {
      marble.delete();
    }
    this.raceMarbles = [];
    this.finishMarbles = [];
    this.releaseQueue = null;
    this.physicsActive = false;
    this.stage.world.flushDestruction();
  }

  private activatePhysics() {
    if (this.physicsActive) {
      return;
    }
    this.physicsActive = true;
    this.stage.physicsEnabled = true;
  }

  private getFinishPlacement(bayIndex: number, slotIndex: number) {
    const placement =
      this.finishPlacements[
        bayIndex * this.configuration.marblesPerTeam + slotIndex
      ];
    return placement?.teamIndex === bayIndex &&
      placement.slotIndex === slotIndex
      ? placement.position
      : null;
  }

  private freezeIfLastMarbleRemains() {
    if (
      this.phase !== "running" ||
      this.releaseQueue?.remaining !== 0 ||
      this.finishTracker.remainingMarbles !== 1
    ) {
      return false;
    }
    this.phase = "complete";
    this.physicsActive = false;
    this.stage.physicsEnabled = false;
    return true;
  }

  private recordOutOfBoundsMarbles(entities: readonly Entity[]) {
    for (const marble of entities) {
      if (!marble.hasTag("released-marble")) {
        continue;
      }
      const teamIndex = this.teamIndexForMarble(marble);
      if (
        teamIndex !== null &&
        this.completeMarble(marble, teamIndex, "out-of-bounds")
      ) {
        return;
      }
    }
  }

  private completeMarble(
    marble: Entity,
    teamIndex: number,
    source: "finish" | "out-of-bounds" = "finish"
  ) {
    const finishRecord = this.finishTracker.record(teamIndex);
    if (source === "out-of-bounds") {
      this.outOfBoundsMarbles++;
    }
    marble.delete();
    this.collectFinishedMarble(
      teamIndex,
      finishRecord.bayIndex,
      finishRecord.slotIndex
    );
    return this.freezeIfLastMarbleRemains();
  }

  private collectFinishedMarble(
    teamIndex: number,
    bayIndex: number,
    slotIndex: number
  ) {
    const position = this.getFinishPlacement(bayIndex, slotIndex);
    if (!position) {
      return;
    }
    this.finishMarbles.push(
      this.stage.spawn(
        marbleDefinition({
          position: [...position],
          radius: this.marbleRadius,
          color: TEAM_COLORS[this.stableTeamIndices[teamIndex]],
          team: `${teamIndex + 1}`,
          tags: ["finished-marble"],
          physical: false,
        })
      )
    );
  }

  private teamIndexForMarble(marble: Entity) {
    for (const tag of marble.tags) {
      if (!tag.startsWith("team:")) {
        continue;
      }
      const teamIndex = Number(tag.slice("team:".length)) - 1;
      if (
        Number.isInteger(teamIndex) &&
        teamIndex >= 0 &&
        teamIndex < this.configuration.teamCount
      ) {
        return teamIndex;
      }
    }
    return null;
  }

  private getSpawnPoint() {
    return this.level.find("spawn-point");
  }

  private releaseWave() {
    if (!this.releaseQueue) {
      return false;
    }
    const waveSize = Math.min(
      this.configuration.teamCount,
      this.releaseQueue.remaining
    );
    const spawnPoint = this.getSpawnPoint();
    if (!spawnPoint) {
      return false;
    }
    const areaRadius = spawnAreaRadius(
      spawnPoint.properties.radius,
      waveSize,
      this.marbleRadius
    );
    const spawnOffsets = randomSpawnOffsetsInCircle(
      waveSize,
      areaRadius,
      this.marbleRadius
    );
    for (const spawnOffset of spawnOffsets) {
      this.releaseNextMarble(spawnOffset);
    }
    return true;
  }

  private releaseNextMarble(spawnOffset: [number, number]) {
    if (!this.releaseQueue) {
      return false;
    }
    const stagedMarble = this.releaseQueue.takeNext();
    const spawnPoint = this.getSpawnPoint();
    if (!stagedMarble || !spawnPoint) {
      return false;
    }

    const spawnRotation = spawnPoint.transform.rotation ?? 0;
    const angle = randomSpawnAngle(
      spawnRotation,
      spawnPoint.properties.directionVariance ??
        DEFAULT_SPAWN_DIRECTION_VARIANCE
    );
    const cosine = Math.cos(spawnRotation);
    const sine = Math.sin(spawnRotation);
    const marble = this.stage.spawn(
      marbleDefinition({
        position: [
          spawnPoint.transform.position[0] +
            spawnOffset[0] * cosine -
            spawnOffset[1] * sine,
          spawnPoint.transform.position[1] +
            spawnOffset[0] * sine +
            spawnOffset[1] * cosine,
        ],
        radius: this.marbleRadius,
        color: TEAM_COLORS[this.stableTeamIndices[stagedMarble.teamIndex]],
        team: `${stagedMarble.teamIndex + 1}`,
        tags: ["race-marble", "released-marble"],
        velocity: [
          Math.cos(angle) * spawnPoint.properties.launchSpeed,
          Math.sin(angle) * spawnPoint.properties.launchSpeed,
        ],
        restitution: 0.15,
        friction: 0.55,
      })
    );
    this.raceMarbles.push(marble);
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
          !marble.markedForDeletion &&
          finish?.hasTag("finish-zone")
        ) {
          const teamIndex = this.teamIndexForMarble(marble);
          if (teamIndex === null) {
            continue;
          }
          if (this.completeMarble(marble, teamIndex)) {
            return;
          }
          break;
        }
      }
    }
  };
}
