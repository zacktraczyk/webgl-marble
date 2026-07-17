import {
  LevelDocument,
  type LevelObjectData,
  type NewLevelObjectData,
  type SerializedLevel,
} from "../../../editor/levelDocument";
import type { Entity } from "../../../engine/core/entity";
import type { Vec2 } from "../../../engine/core/transform";
import { millisecondsToSimulationSeconds } from "../../../engine/physics/physics";
import type Stage from "../../../engine/stage";
import { getLevelObjectMotionPose } from "../../../editor/levelMotion";
import { levelObjectDefinitions } from "../../../game/prefabs/levelObject";
import {
  MAX_MARBLE_RADIUS,
  MIN_MARBLE_RADIUS,
  STAGING_MARBLE_GAP,
} from "../constants";
import type { RoundConfiguration } from "../types";

type LevelPrefab = LevelObjectData["prefab"];

export class AuthoredLevel {
  readonly document: LevelDocument;
  private readonly entities = new Map<string, Entity[]>();
  private readonly hiddenObjects = new Set<string>();
  private teamCount: number;
  private marblesPerTeam: number;
  private raceMarbleRadius = MAX_MARBLE_RADIUS;

  constructor(
    private readonly stage: Stage,
    configuration: Pick<RoundConfiguration, "teamCount" | "marblesPerTeam">,
    wallThickness: number
  ) {
    this.teamCount = configuration.teamCount;
    this.marblesPerTeam = configuration.marblesPerTeam;
    this.document = new LevelDocument(
      "Untitled level",
      [stage.width, stage.height],
      { wallThickness }
    );
  }

  setRoundConfiguration(
    configuration: Pick<RoundConfiguration, "teamCount" | "marblesPerTeam">
  ) {
    if (
      this.teamCount === configuration.teamCount &&
      this.marblesPerTeam === configuration.marblesPerTeam
    ) {
      return;
    }
    this.teamCount = configuration.teamCount;
    this.marblesPerTeam = configuration.marblesPerTeam;
    for (const object of [...this.objects]) {
      if (
        object.prefab === "staging-rack" ||
        object.prefab === "finish-zone" ||
        object.prefab === "spawn-point"
      ) {
        this.refresh(object);
      }
    }
  }

  setRaceMarbleRadius(marbleRadius: number) {
    if (Math.abs(this.raceMarbleRadius - marbleRadius) < Number.EPSILON) {
      return;
    }
    this.raceMarbleRadius = marbleRadius;
    const spawnPoint = this.find("spawn-point");
    if (spawnPoint) {
      this.refresh(spawnPoint);
    }
  }

  get objects() {
    return this.document.objects;
  }

  get wallThickness() {
    return this.document.settings.wallThickness;
  }

  add(data: NewLevelObjectData) {
    return this.spawn(this.document.add(data));
  }

  remove(id: string) {
    this.clearRuntimeEntities(id);
    this.hiddenObjects.delete(id);
    this.document.remove(id);
  }

  setVisible(id: string, visible: boolean) {
    if (visible) {
      this.hiddenObjects.delete(id);
    } else {
      this.hiddenObjects.add(id);
    }
    for (const entity of this.entities.get(id) ?? []) {
      entity.scale = visible ? [1, 1] : [0, 0];
    }
  }

  resize(size: Vec2, boundaries: NewLevelObjectData[]) {
    for (const object of [...this.objects]) {
      if (object.locked) {
        this.remove(object.id);
      }
    }
    this.document.size = [...size];
    for (const boundary of boundaries) {
      this.add(boundary);
    }
  }

  setWallThickness(wallThickness: number) {
    this.document.settings.wallThickness = wallThickness;
    for (const object of [...this.objects]) {
      if (object.prefab === "wall" || object.prefab === "finish-zone") {
        this.refresh(object);
      }
    }
  }

  dispose() {
    for (const object of [...this.objects]) {
      this.clearRuntimeEntities(object.id);
    }
    this.hiddenObjects.clear();
  }

  restore(serialized: SerializedLevel) {
    for (const object of [...this.objects]) {
      this.clearRuntimeEntities(object.id);
    }
    this.hiddenObjects.clear();
    this.document.restore(serialized);
    for (const object of this.objects) {
      this.spawn(object);
    }
  }

  replaceUnique(prefab: "spawn-point", data: NewLevelObjectData) {
    const current = this.find(prefab);
    if (current) {
      this.remove(current.id);
    }
    return this.add(data);
  }

  find<Prefab extends LevelPrefab>(prefab: Prefab) {
    return (
      (this.objects.find((object) => object.prefab === prefab) as
        | Extract<LevelObjectData, { prefab: Prefab }>
        | undefined) ?? null
    );
  }

  has(prefab: LevelPrefab) {
    return this.objects.some((object) => object.prefab === prefab);
  }

  refresh(object: LevelObjectData) {
    this.clearRuntimeEntities(object.id);
    this.spawn(object);
  }

  prepareMotionStep(elapsedMs: number, deltaMs: number) {
    const deltaSeconds = millisecondsToSimulationSeconds(deltaMs);
    if (deltaSeconds <= 0) {
      return;
    }

    for (const object of this.objects) {
      if (!object.motion) {
        continue;
      }
      const current = getLevelObjectMotionPose(
        object,
        this.wallThickness,
        elapsedMs
      );
      const next = getLevelObjectMotionPose(
        object,
        this.wallThickness,
        elapsedMs + deltaMs
      );
      for (const entity of this.entities.get(object.id) ?? []) {
        entity.position = [...current.position];
        entity.rotation = current.rotation;
        const physicsEntity = this.stage.getPhysicsEntity(entity);
        if (!physicsEntity) {
          continue;
        }
        physicsEntity.velocity = [
          (next.position[0] - current.position[0]) / deltaSeconds,
          (next.position[1] - current.position[1]) / deltaSeconds,
        ];
        physicsEntity.angularVelocity =
          (next.rotation - current.rotation) / deltaSeconds;
      }
    }
  }

  resetMotion() {
    for (const object of this.objects) {
      if (!object.motion) {
        continue;
      }
      const rest = getLevelObjectMotionPose(object, this.wallThickness, 0);
      for (const entity of this.entities.get(object.id) ?? []) {
        entity.position = [...rest.position];
        entity.rotation = rest.rotation;
        const physicsEntity = this.stage.getPhysicsEntity(entity);
        if (physicsEntity) {
          physicsEntity.velocity = [0, 0];
          physicsEntity.angularVelocity = 0;
        }
      }
    }
  }

  private spawn(object: LevelObjectData) {
    const entities = levelObjectDefinitions(object, {
      teamCount: this.teamCount,
      marblesPerTeam: this.marblesPerTeam,
      wallThickness: this.wallThickness,
      maximumMarbleRadius: MAX_MARBLE_RADIUS,
      minimumMarbleRadius: MIN_MARBLE_RADIUS,
      marbleGap: STAGING_MARBLE_GAP,
      raceMarbleRadius: this.raceMarbleRadius,
    }).map((definition) => this.stage.spawn(definition));
    if (this.hiddenObjects.has(object.id)) {
      for (const entity of entities) {
        entity.scale = [0, 0];
      }
    }
    this.entities.set(object.id, entities);
    return object;
  }

  private clearRuntimeEntities(id: string) {
    for (const entity of this.entities.get(id) ?? []) {
      entity.delete();
    }
    this.entities.delete(id);
    this.stage.world.flushDestruction();
  }
}
