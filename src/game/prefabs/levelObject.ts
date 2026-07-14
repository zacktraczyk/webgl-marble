import type { EntityDefinition } from "../../engine/core/definition";
import type { LevelObjectData } from "../../editor/levelDocument";
import { getLevelObjectShape } from "../../editor/levelGeometry";
import { finishZoneDefinition } from "./finishZone";
import { circleDefinition } from "./primitives/circle";
import { rectangleDefinition } from "./primitives/rectangle";
import { spawnPointDefinition } from "./spawnPoint";
import { stagingRackDefinitions } from "./stagingRack";

/** Converts serializable editor data into runtime-only component definitions. */
export const levelObjectDefinitions = (
  object: LevelObjectData,
  {
    teamCount = 1,
    wallThickness = 15,
  }: { teamCount?: number; wallThickness?: number } = {}
): EntityDefinition[] => {
  let definitions: EntityDefinition[];

  switch (object.prefab) {
    case "wall": {
      const shape = getLevelObjectShape(object, wallThickness);
      if (shape.kind !== "rectangle") {
        return [];
      }
      definitions = [
        rectangleDefinition({
          position: shape.position,
          rotation: shape.rotation,
          width: shape.width,
          height: shape.height,
          color: object.properties.color,
        }),
      ];
      break;
    }
    case "bumper":
      definitions = [
        circleDefinition({
          position: object.transform.position,
          bodyType: "static",
          ...object.properties,
        }),
      ];
      break;
    case "finish-zone":
      definitions = [
        finishZoneDefinition({
          position: object.transform.position,
          rotation: object.transform.rotation,
          ...object.properties,
        }),
      ];
      break;
    case "staging-rack":
      definitions = stagingRackDefinitions({
        position: object.transform.position,
        teamCount,
        ...object.properties,
      });
      break;
    case "spawn-point":
      definitions = [
        spawnPointDefinition({
          position: object.transform.position,
          rotation: object.transform.rotation,
          ...object.properties,
        }),
      ];
      break;
  }

  return definitions.map((definition) => ({
    ...definition,
    tags: [
      ...(definition.tags ?? []),
      "level-object",
      `level-object:${object.id}`,
    ],
  }));
};
