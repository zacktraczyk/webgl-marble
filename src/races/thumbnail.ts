import type { LevelObjectData, SerializedLevel } from "../editor/levelDocument";
import type { Color } from "../engine/vdu/component";

export type LevelThumbnailOptions = {
  width?: number;
  height?: number;
  pixelRatio?: number;
  padding?: number;
  background?: string;
  courseBackground?: string;
  border?: string;
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

const drawObject = (
  context: CanvasRenderingContext2D,
  object: LevelObjectData,
  defaultWallThickness: number
) => {
  if (object.prefab === "wall") {
    context.beginPath();
    context.moveTo(...object.properties.start);
    context.lineTo(...object.properties.end);
    context.strokeStyle = colorCss(object.properties.color);
    context.lineWidth = object.properties.thickness ?? defaultWallThickness;
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
    if (object.prefab === "finish-zone") {
      context.globalAlpha = 0.7;
      context.fillRect(-width / 2, -height / 2, width, height);
      context.globalAlpha = 1;
      return;
    }

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

  for (const object of level.objects) {
    drawMotionGuide(context, object, level.settings.wallThickness);
  }
  for (const object of level.objects) {
    drawObject(context, object, level.settings.wallThickness);
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
