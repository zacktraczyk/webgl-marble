import type { EntityDefinition } from "../../engine/core/definition";
import type { LevelObjectData } from "../../editor/levelDocument";
import { finishZoneDefinition } from "./finishZone";
import { circleDefinition } from "./primitives/circle";
import { rectangleDefinition } from "./primitives/rectangle";
import { spawnPointDefinition } from "./spawnPoint";
import { stagingRackDefinitions } from "./stagingRack";

/** Converts serializable editor data into runtime-only component definitions. */
export const levelObjectDefinitions = (
  object: LevelObjectData,
  { teamCount = 1 }: { teamCount?: number } = {}
): EntityDefinition[] => {
  const position = object.transform.position;
  let definitions: EntityDefinition[];

  switch (object.prefab) {
    case "wall":
      definitions = [
        rectangleDefinition({
          position,
          rotation: object.transform.rotation,
          ...object.properties,
        }),
      ];
      break;
    case "bumper":
      definitions = [
        circleDefinition({
          position,
          bodyType: "static",
          ...object.properties,
        }),
      ];
      break;
    case "finish-zone":
      definitions = [
        finishZoneDefinition({
          position,
          ...object.properties,
        }),
      ];
      break;
    case "staging-rack":
      definitions = stagingRackDefinitions({
        position,
        teamCount,
        ...object.properties,
      });
      break;
    case "spawn-point":
      definitions = [
        spawnPointDefinition({
          position,
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
