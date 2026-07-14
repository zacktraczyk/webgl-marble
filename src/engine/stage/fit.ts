export type StageFitInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type StageFitInsetSource = StageFitInsets | (() => StageFitInsets);

export const uniformStageFitInsets = (padding: number): StageFitInsets => ({
  top: padding,
  right: padding,
  bottom: padding,
  left: padding,
});

export const calculateStageFit = ({
  viewportWidth,
  viewportHeight,
  stageWidth,
  stageHeight,
  insets = uniformStageFitInsets(0),
}: {
  viewportWidth: number;
  viewportHeight: number;
  stageWidth: number;
  stageHeight: number;
  insets?: StageFitInsets;
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
    zoom: Math.min(availableWidth / stageWidth, availableHeight / stageHeight),
    cameraPosition: [
      insets.left + availableWidth / 2,
      insets.top + availableHeight / 2,
    ] as [number, number],
  };
};
