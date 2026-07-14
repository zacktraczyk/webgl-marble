import type { TransformInput, Vec2 } from "../engine/core/transform";
import type { Color } from "../engine/vdu/component";

type BaseLevelObject = {
  id: string;
  locked?: boolean;
};

type TransformedLevelObject = BaseLevelObject & {
  transform: TransformInput;
};

export type LevelSettings = {
  wallThickness: number;
};

export type LevelObjectData =
  | (BaseLevelObject & {
      prefab: "wall";
      properties: {
        start: Vec2;
        end: Vec2;
        thickness?: number;
        color: Color;
      };
    })
  | (TransformedLevelObject & {
      prefab: "bumper";
      properties: { radius: number; color: Color };
    })
  | (TransformedLevelObject & {
      prefab: "finish-zone";
      properties: { width: number; height: number; color: Color };
    })
  | (TransformedLevelObject & {
      prefab: "staging-rack";
      properties: {
        width: number;
        height: number;
        wallThickness: number;
        color: Color;
      };
    })
  | (TransformedLevelObject & {
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
  version: 2;
  name: string;
  size: Vec2;
  settings: LevelSettings;
  objects: LevelObjectData[];
}

/** Serializable authoring state, deliberately independent of runtime entities. */
export class LevelDocument {
  readonly version = 2 as const;
  readonly objects: LevelObjectData[] = [];
  private _nextObjectId = 0;

  constructor(
    public name: string,
    public size: Vec2,
    public settings: LevelSettings
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

  restore(serialized: SerializedLevel) {
    this.name = serialized.name;
    this.size = [...serialized.size];
    this.settings = structuredClone(serialized.settings);
    this.objects.splice(
      0,
      this.objects.length,
      ...structuredClone(serialized.objects)
    );
    this._nextObjectId = this.objects.reduce((nextId, object) => {
      const match = /^level-object-(\d+)$/.exec(object.id);
      return match ? Math.max(nextId, Number(match[1]) + 1) : nextId;
    }, 0);
  }

  serialize(): SerializedLevel {
    return {
      version: this.version,
      name: this.name,
      size: [...this.size],
      settings: structuredClone(this.settings),
      objects: structuredClone(this.objects),
    };
  }
}
