export type Vec2 = [number, number];

export interface Transform {
  position: Vec2;
  rotation: number;
  scale: Vec2;
}

export type TransformInput = Partial<Omit<Transform, "position">> &
  Pick<Transform, "position">;

export const createTransform = ({
  position,
  rotation = 0,
  scale = [1, 1],
}: TransformInput): Transform => ({
  position: [...position],
  rotation,
  scale: [...scale],
});

export const identityTransform = (): Transform =>
  createTransform({ position: [0, 0] });

export const copyTransform = (target: Transform, source: Transform): void => {
  target.position[0] = source.position[0];
  target.position[1] = source.position[1];
  target.rotation = source.rotation;
  target.scale[0] = source.scale[0];
  target.scale[1] = source.scale[1];
};
