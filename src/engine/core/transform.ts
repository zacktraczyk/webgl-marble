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

/** Rotates a local offset by `rotation`, then translates it by `position`. */
export const applyTransform = (
  position: Vec2,
  rotation: number,
  [localX, localY]: Vec2
): Vec2 => {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    position[0] + localX * cosine - localY * sine,
    position[1] + localX * sine + localY * cosine,
  ];
};
