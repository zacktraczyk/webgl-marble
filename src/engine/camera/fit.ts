import type { Vec2 } from "../core/transform";

export type CameraFitInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type WorldRect = {
  center: Vec2;
  width: number;
  height: number;
};

export type CameraFitInsetSource = CameraFitInsets | (() => CameraFitInsets);

/**
 * Builds camera-fit insets with the same padding on all four sides.
 * @param padding inset applied to every side, in screen pixels
 * @returns the insets
 */
export const uniformCameraFitInsets = (padding: number): CameraFitInsets => ({
  top: padding,
  right: padding,
  bottom: padding,
  left: padding,
});

/**
 * Computes the zoom and screen-space center that fit content of the given size
 * into the viewport, after subtracting insets. Origin-centered — see
 * `calculateCameraFitForRect` for arbitrarily positioned content.
 * @returns `zoom` (uniform scale) and `position` (screen-space center, in px)
 */
export const calculateCameraFit = ({
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight,
  insets = uniformCameraFitInsets(0),
}: {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  insets?: CameraFitInsets;
}) => {
  const availableWidth = Math.max(
    0,
    viewportWidth - insets.left - insets.right
  );
  const availableHeight = Math.max(
    0,
    viewportHeight - insets.top - insets.bottom
  );

  return {
    zoom: Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight
    ),
    position: [
      insets.left + availableWidth / 2,
      insets.top + availableHeight / 2,
    ] as [number, number],
  };
};

/**
 * Fits an arbitrarily positioned world rect. Camera2D maps world (0,0) to the
 * screen point `position`, so the origin-centered fit is shifted by
 * `-rect.center * zoom` to bring the rect's center to the viewport center.
 */
export const calculateCameraFitForRect = ({
  viewportWidth,
  viewportHeight,
  rect,
  insets = uniformCameraFitInsets(0),
}: {
  viewportWidth: number;
  viewportHeight: number;
  rect: WorldRect;
  insets?: CameraFitInsets;
}): { zoom: number; position: Vec2 } => {
  const fit = calculateCameraFit({
    viewportWidth,
    viewportHeight,
    contentWidth: rect.width,
    contentHeight: rect.height,
    insets,
  });

  return {
    zoom: fit.zoom,
    position: [
      fit.position[0] - rect.center[0] * fit.zoom,
      fit.position[1] - rect.center[1] * fit.zoom,
    ],
  };
};

/**
 * Fraction (0..1) of the rect's vertical extent currently inside the viewport.
 * World Y is recovered from the camera transform (`worldY = (screenY -
 * position.y) / zoom`); +Y is downward, so the screen top maps to the smaller
 * world Y.
 */
export const visibleVerticalFraction = (
  camera: { position: Vec2; zoom: number },
  viewportHeight: number,
  rect: WorldRect
): number => {
  if (rect.height <= 0 || camera.zoom <= 0) {
    return 0;
  }

  const viewTop = (0 - camera.position[1]) / camera.zoom;
  const viewBottom = (viewportHeight - camera.position[1]) / camera.zoom;

  const rectTop = rect.center[1] - rect.height / 2;
  const rectBottom = rect.center[1] + rect.height / 2;

  const overlap =
    Math.min(viewBottom, rectBottom) - Math.max(viewTop, rectTop);

  return Math.max(0, Math.min(1, overlap / rect.height));
};
