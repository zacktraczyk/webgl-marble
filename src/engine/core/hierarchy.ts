import type { EntityId } from "./entity";
import {
  createTransform,
  type Transform,
  type TransformInput,
} from "./transform";

export interface ParentRelationship {
  parent: EntityId;
  localTransform: Transform;
  destroyWithParent: boolean;
}

export const createParentRelationship = ({
  parent,
  localTransform = { position: [0, 0] },
  destroyWithParent = true,
}: {
  parent: EntityId;
  localTransform?: TransformInput;
  destroyWithParent?: boolean;
}): ParentRelationship => ({
  parent,
  localTransform: createTransform(localTransform),
  destroyWithParent,
});

export const composeTransform = (
  target: Transform,
  parent: Transform,
  local: Transform
) => {
  const localX = local.position[0] * parent.scale[0];
  const localY = local.position[1] * parent.scale[1];
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);

  target.position[0] = parent.position[0] + localX * cos - localY * sin;
  target.position[1] = parent.position[1] + localX * sin + localY * cos;
  target.rotation = parent.rotation + local.rotation;
  target.scale[0] = parent.scale[0] * local.scale[0];
  target.scale[1] = parent.scale[1] * local.scale[1];
};
