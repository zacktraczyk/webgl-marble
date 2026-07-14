import type { TransformInput, Vec2 } from "../engine/core/transform";
import type { Color } from "../engine/vdu/component";

type BaseLevelObject = {
  id: string;
  locked?: boolean;
  transform: TransformInput;
};

export type LevelObjectData =
  | (BaseLevelObject & {
      prefab: "wall";
      properties: { width: number; height: number; color: Color };
    })
  | (BaseLevelObject & {
      prefab: "bumper";
      properties: { radius: number; color: Color };
    })
  | (BaseLevelObject & {
      prefab: "finish-zone";
      properties: { width: number; height: number; color: Color };
    })
  | (BaseLevelObject & {
      prefab: "staging-rack";
      properties: {
        width: number;
        height: number;
        wallThickness: number;
        color: Color;
      };
    })
  | (BaseLevelObject & {
      prefab: "spawn-point";
      properties: {
        radius: number;
        color: Color;
        launchSpeed: number;
        directionVariance?: number;
      };
    });

export type NewLevelObjectData = LevelObjectData extends infer ObjectData
  ? ObjectData extends LevelObjectData
    ? Omit<ObjectData, "id">
    : never
  : never;

export interface SerializedLevel {
  version: 1;
  name: string;
  size: Vec2;
  objects: LevelObjectData[];
}

/** Serializable authoring state, deliberately independent of runtime entities. */
export class LevelDocument {
  readonly version = 1 as const;
  readonly objects: LevelObjectData[] = [];
  private _nextObjectId = 0;

  constructor(
    public name: string,
    public size: Vec2
  ) {}

  add(data: NewLevelObjectData): LevelObjectData {
    const object = {
      ...data,
      id: `level-object-${this._nextObjectId++}`,
    } as LevelObjectData;
    this.objects.push(object);
    return object;
  }

  remove(id: string) {
    const index = this.objects.findIndex((object) => object.id === id);
    if (index >= 0) {
      this.objects.splice(index, 1);
    }
  }

  serialize(): SerializedLevel {
    return {
      version: this.version,
      name: this.name,
      size: [...this.size],
      objects: structuredClone(this.objects),
    };
  }
}
