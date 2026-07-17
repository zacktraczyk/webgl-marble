import type { Vec2 } from "../../engine/core/transform";
import type { RaceLegDocument } from "../../races/types";

export type LegFrame = {
  index: number;
  size: Vec2;
  center: Vec2;
  top: number;
  bottom: number;
};

/**
 * Stacks legs edge-to-edge along +Y (downward in this engine). Leg 0 is
 * centered at the origin; each later leg's top edge meets the previous leg's
 * bottom edge, and every leg is horizontally centered on x = 0.
 */
export const computeLegStackLayout = (
  legs: readonly RaceLegDocument[]
): LegFrame[] => {
  const frames: LegFrame[] = [];
  let previousBottom = 0;

  legs.forEach((leg, index) => {
    const size: Vec2 = [leg.level.size[0], leg.level.size[1]];
    const height = size[1];
    const centerY = index === 0 ? 0 : previousBottom + height / 2;
    const center: Vec2 = [0, centerY];
    const top = centerY - height / 2;
    const bottom = centerY + height / 2;

    frames.push({ index, size, center, top, bottom });
    previousBottom = bottom;
  });

  return frames;
};
