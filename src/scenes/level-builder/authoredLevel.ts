import {
  LevelDocument,
  type LevelObjectData,
  type NewLevelObjectData,
  type SerializedLevel,
} from "../../editor/levelDocument";
import type { Entity } from "../../engine/core/entity";
import type { Vec2 } from "../../engine/core/transform";
import type Stage from "../../engine/stage";
import { levelObjectDefinitions } from "../../game/prefabs/levelObject";

type LevelPrefab = LevelObjectData["prefab"];

export class AuthoredLevel {
  readonly document: LevelDocument;
  private readonly entities = new Map<string, Entity[]>();
  private readonly hiddenObjects = new Set<string>();
  private teamCount: number;

  constructor(
    private readonly stage: Stage,
    teamCount: number,
    wallThickness: number
  ) {
    this.teamCount = teamCount;
    this.document = new LevelDocument(
      "Untitled level",
      [stage.width, stage.height],
      { wallThickness }
    );
  }

  setTeamCount(teamCount: number) {
    this.teamCount = teamCount;
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
      if (object.prefab === "wall") {
        this.refresh(object);
      }
    }
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

  private spawn(object: LevelObjectData) {
    const entities = levelObjectDefinitions(object, {
      teamCount: this.teamCount,
      wallThickness: this.wallThickness,
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
