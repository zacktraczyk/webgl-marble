const NATIVE_ZOOM_SNAP_TOLERANCE = 0.1;

export const calculateStageFitZoom = ({
  viewportWidth,
  viewportHeight,
  stageWidth,
  stageHeight,
  padding = 0,
  snapToNativeZoom = false,
}: {
  viewportWidth: number;
  viewportHeight: number;
  stageWidth: number;
  stageHeight: number;
  padding?: number;
  snapToNativeZoom?: boolean;
}) => {
  const fittedZoom = Math.min(
    (viewportWidth - padding * 2) / stageWidth,
    (viewportHeight - padding * 2) / stageHeight
  );
  const stageFitsAtNativeZoom =
    viewportWidth >= stageWidth && viewportHeight >= stageHeight;

  if (
    snapToNativeZoom &&
    stageFitsAtNativeZoom &&
    Math.abs(fittedZoom - 1) <= NATIVE_ZOOM_SNAP_TOLERANCE
  ) {
    return 1;
  }

  return fittedZoom;
};
