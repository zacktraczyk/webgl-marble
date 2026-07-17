import type { LevelObjectData, SerializedLevel } from "../editor/levelDocument";
import type {
  FinishRackFrame,
  FinishRackRect,
} from "../game/prefabs/finishZone";
import {
  FINISH_DARK_COLOR,
  FINISH_LIGHT_COLOR,
  FINISH_RACK_BACKGROUND,
  FINISH_RACK_WALL,
  createFinishRackFrame,
  finishLineCells,
} from "../game/prefabs/finishZone";
import type { Color } from "../engine/vdu/component";

export type LevelThumbnailOptions = {
  width?: number;
  height?: number;
  pixelRatio?: number;
  padding?: number;
  background?: string;
  courseBackground?: string;
  border?: string;
  /**
   * Teams racing this leg. When set, finish zones render as the real finish
   * rack (checkered line plus one bay per team) instead of a flat placeholder.
   */
  teamCount?: number;
};

type ObjectDrawSettings = {
  wallThickness: number;
  teamCount?: number;
};

const colorCss = ([red, green, blue, alpha]: Color) =>
  `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(
    blue * 255
  )}, ${alpha})`;

const withTransform = (
  context: CanvasRenderingContext2D,
  object: Extract<LevelObjectData, { transform: unknown }>,
  draw: () => void
) => {
  const { position, rotation = 0, scale = [1, 1] } = object.transform;
  context.save();
  context.translate(position[0], position[1]);
  context.rotate(rotation);
  context.scale(scale[0], scale[1]);
  draw();
  context.restore();
};

const drawMotionGuide = (
  context: CanvasRenderingContext2D,
  object: LevelObjectData,
  wallThickness: number
) => {
  if (!object.motion) {
    return;
  }
  context.save();
  context.strokeStyle = "rgba(34, 211, 238, 0.65)";
  context.lineWidth = Math.max(1, wallThickness * 0.14);
  context.setLineDash([wallThickness * 0.45, wallThickness * 0.35]);
  if (object.motion.type === "oscillate" && object.prefab === "wall") {
    const center = [
      (object.properties.start[0] + object.properties.end[0]) / 2,
      (object.properties.start[1] + object.properties.end[1]) / 2,
    ];
    context.beginPath();
    context.moveTo(
      center[0] - object.motion.vector[0],
      center[1] - object.motion.vector[1]
    );
    context.lineTo(
      center[0] + object.motion.vector[0],
      center[1] + object.motion.vector[1]
    );
    context.stroke();
  } else if (object.prefab === "wall") {
    const start = object.properties.start;
    const end = object.properties.end;
    const pivot =
      object.motion.type === "rotate" && object.motion.pivot === "start"
        ? start
        : [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    context.beginPath();
    context.arc(
      pivot[0],
      pivot[1],
      Math.hypot(end[0] - start[0], end[1] - start[1]) / 2,
      0,
      Math.PI * 2
    );
    context.stroke();
  }
  context.restore();
};

const fillRect = (context: CanvasRenderingContext2D, rect: FinishRackRect) => {
  context.fillRect(
    rect.position[0] - rect.width / 2,
    rect.position[1] - rect.height / 2,
    rect.width,
    rect.height
  );
};

const drawFinishZone = (
  context: CanvasRenderingContext2D,
  object: Extract<LevelObjectData, { prefab: "finish-zone" }>,
  { wallThickness, teamCount }: ObjectDrawSettings
) => {
  const { width, height } = object.properties;
  let frame: FinishRackFrame | null = null;
  if (teamCount !== undefined) {
    try {
      frame = createFinishRackFrame({ width, height, wallThickness, teamCount });
    } catch {
      // The rack cannot fit this team count; fall back to the placeholder.
    }
  }
  withTransform(context, object, () => {
    if (!frame) {
      context.fillStyle = colorCss(object.properties.color);
      context.globalAlpha = 0.7;
      context.fillRect(-width / 2, -height / 2, width, height);
      context.globalAlpha = 1;
      return;
    }
    context.fillStyle = colorCss(FINISH_RACK_BACKGROUND);
    context.fillRect(-width / 2, -height / 2, width, height);
    context.fillStyle = colorCss(FINISH_RACK_WALL);
    for (const rect of [
      frame.bottomWall,
      ...frame.sideWalls,
      ...frame.dividers,
    ]) {
      fillRect(context, rect);
    }
    context.save();
    context.translate(...frame.finishLine.position);
    for (const cell of finishLineCells(frame.finishLine)) {
      context.fillStyle = colorCss(
        cell.light ? FINISH_LIGHT_COLOR : FINISH_DARK_COLOR
      );
      fillRect(context, cell);
    }
    context.restore();
  });
};

const drawObject = (
  context: CanvasRenderingContext2D,
  object: LevelObjectData,
  settings: ObjectDrawSettings
) => {
  if (object.prefab === "wall") {
    context.beginPath();
    context.moveTo(...object.properties.start);
    context.lineTo(...object.properties.end);
    context.strokeStyle = colorCss(object.properties.color);
    context.lineWidth = object.properties.thickness ?? settings.wallThickness;
    context.lineCap = "round";
    context.stroke();
    return;
  }

  if (object.prefab === "bumper") {
    withTransform(context, object, () => {
      context.beginPath();
      context.arc(0, 0, object.properties.radius, 0, Math.PI * 2);
      context.fillStyle = colorCss(object.properties.color);
      context.fill();
    });
    return;
  }

  if (object.prefab === "finish-zone") {
    drawFinishZone(context, object, settings);
    return;
  }

  withTransform(context, object, () => {
    context.fillStyle = colorCss(object.properties.color);
    if (object.prefab === "spawn-point") {
      context.globalAlpha = 0.82;
      context.beginPath();
      context.arc(0, 0, object.properties.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = "rgba(255, 255, 255, 0.9)";
      context.lineWidth = Math.max(1.5, object.properties.radius * 0.12);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(object.properties.radius * 1.4, 0);
      context.stroke();
      return;
    }

    const width = object.properties.width;
    const height = object.properties.height;
    context.lineWidth = object.properties.wallThickness;
    context.strokeStyle = colorCss(object.properties.color);
    context.strokeRect(
      -width / 2 + object.properties.wallThickness / 2,
      -height / 2 + object.properties.wallThickness / 2,
      width - object.properties.wallThickness,
      height - object.properties.wallThickness
    );
  });
};

export const drawLevelThumbnail = (
  context: CanvasRenderingContext2D,
  level: SerializedLevel,
  options: LevelThumbnailOptions = {}
) => {
  const pixelRatio = options.pixelRatio ?? 1;
  const width = options.width ?? context.canvas.width / pixelRatio;
  const height = options.height ?? context.canvas.height / pixelRatio;
  const padding = options.padding ?? Math.min(width, height) * 0.06;
  const background = options.background ?? "#18181b";
  const courseBackground = options.courseBackground ?? "#27272a";
  const border = options.border ?? "#52525b";
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const scale = Math.max(
    0.0001,
    Math.min(
      (width - padding * 2) / level.size[0],
      (height - padding * 2) / level.size[1]
    )
  );
  context.translate(width / 2, height / 2);
  context.scale(scale, scale);

  context.fillStyle = courseBackground;
  context.fillRect(
    -level.size[0] / 2,
    -level.size[1] / 2,
    level.size[0],
    level.size[1]
  );
  context.strokeStyle = border;
  context.lineWidth = 1 / scale;
  context.strokeRect(
    -level.size[0] / 2,
    -level.size[1] / 2,
    level.size[0],
    level.size[1]
  );

  const settings: ObjectDrawSettings = {
    wallThickness: level.settings.wallThickness,
    teamCount: options.teamCount,
  };
  for (const object of level.objects) {
    drawMotionGuide(context, object, level.settings.wallThickness);
  }
  for (const object of level.objects) {
    drawObject(context, object, settings);
  }
  context.restore();
};

export const renderLevelThumbnail = (
  canvas: HTMLCanvasElement,
  level: SerializedLevel,
  options: LevelThumbnailOptions = {}
) => {
  const width = options.width ?? (canvas.clientWidth || canvas.width || 320);
  const height =
    options.height ?? (canvas.clientHeight || canvas.height || 180);
  const pixelRatio =
    options.pixelRatio ??
    (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }
  drawLevelThumbnail(context, level, {
    ...options,
    width,
    height,
    pixelRatio,
  });
  return true;
};
