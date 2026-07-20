export type Vec2 = [number, number];

export interface Transform {
  position: Vec2;
  rotation: number;
  scale: Vec2;
}

export type TransformInput = Partial<Omit<Transform, "position">> &
  Pick<Transform, "position">;

/**
 * Builds a Transform, defaulting `rotation` to 0 (radians) and `scale` to
 * [1, 1]. `position` and `scale` are copied, so the result shares no array
 * references with the input.
 * @param input transform values; `position` is required
 * @returns a new Transform
 */
export const createTransform = ({
  position,
  rotation = 0,
  scale = [1, 1],
}: TransformInput): Transform => ({
  position: [...position],
  rotation,
  scale: [...scale],
});

/**
 * Rotates a local offset by `rotation`, then translates it by `position`.
 * @param position world-space translation applied after rotation
 * @param rotation rotation in radians
 * @param local the local-space offset [localX, localY]
 * @returns the resulting world-space point
 */
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
