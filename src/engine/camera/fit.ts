export type CameraFitInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CameraFitInsetSource = CameraFitInsets | (() => CameraFitInsets);

export const uniformCameraFitInsets = (padding: number): CameraFitInsets => ({
  top: padding,
  right: padding,
  bottom: padding,
  left: padding,
});

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
