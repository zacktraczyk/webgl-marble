import {
  LevelDocument,
  type LevelObjectData,
  type NewLevelObjectData,
} from "../../editor/levelDocument";
import type { Entity } from "../../engine/core/entity";
import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import { levelObjectDefinitions } from "../../game/prefabs/levelObject";

type LevelPrefab = LevelObjectData["prefab"];

export class AuthoredLevel {
  readonly document: LevelDocument;
  private readonly entities = new Map<string, Entity[]>();
  private readonly runtimePositions = new Map<string, Vec2>();
  private teamCount: number;

  constructor(
    private readonly stage: Stage,
    teamCount: number
  ) {
    this.teamCount = teamCount;
    this.document = new LevelDocument("Untitled level", [
      stage.width,
      stage.height,
    ]);
  }

  setTeamCount(teamCount: number) {
    this.teamCount = teamCount;
  }

  get objects() {
    return this.document.objects;
  }

  add(data: NewLevelObjectData) {
    return this.spawn(this.document.add(data));
  }

  remove(id: string) {
    this.clearRuntimeEntities(id);
    this.document.remove(id);
  }

  replaceUnique(
    prefab: "staging-rack" | "spawn-point",
    data: NewLevelObjectData
  ) {
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
    const previousPosition = this.runtimePositions.get(object.id);
    this.clearRuntimeEntities(object.id);
    this.spawn(object);
    return previousPosition ? ([...previousPosition] as Vec2) : null;
  }

  private spawn(object: LevelObjectData) {
    const entities = levelObjectDefinitions(object, {
      teamCount: this.teamCount,
    }).map((definition) => this.stage.spawn(definition));
    this.entities.set(object.id, entities);
    this.runtimePositions.set(object.id, [...object.transform.position]);
    return object;
  }

  private clearRuntimeEntities(id: string) {
    for (const entity of this.entities.get(id) ?? []) {
      entity.delete();
    }
    this.entities.delete(id);
    this.runtimePositions.delete(id);
    this.stage.world.flushDestruction();
  }
}
