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
