import type { EntityDefinition } from "../../engine/core/definition";
import type { LevelObjectData } from "../../editor/levelDocument";
import { finishZoneDefinition } from "./finishZone";
import { marbleDefinition } from "./marble";
import { rectangleDefinition } from "./primitives/rectangle";

/** Converts serializable editor data into runtime-only component definitions. */
export const levelObjectDefinition = (
  object: LevelObjectData
): EntityDefinition => {
  const position = object.transform.position;
  let definition: EntityDefinition;

  switch (object.prefab) {
    case "wall":
      definition = rectangleDefinition({
        position,
        rotation: object.transform.rotation,
        ...object.properties,
      });
      break;
    case "marble":
      definition = marbleDefinition({
        position,
        ...object.properties,
      });
      break;
    case "finish-zone":
      definition = finishZoneDefinition({
        position,
        ...object.properties,
      });
      break;
  }

  definition.tags = [
    ...(definition.tags ?? []),
    "level-object",
    `level-object:${object.id}`,
  ];
  return definition;
};
