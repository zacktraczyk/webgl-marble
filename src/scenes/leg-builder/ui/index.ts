const requireElement = <T extends HTMLElement>(
  element: HTMLElement | null,
  label: string
) => {
  if (!element) {
    throw new Error(`Leg builder element not found: ${label}`);
  }
  return element as T;
};

export type BuilderUi = {
  root: HTMLElement;
  toolbar: HTMLElement;
  raceControls: HTMLElement;
  toolHintOutput: HTMLElement;
  tooltip: HTMLElement;
  tooltipLabel: HTMLElement;
  tooltipShortcut: HTMLElement;
  tooltipArrow: HTMLElement;
  panButton: HTMLButtonElement;
  pointerButton: HTMLButtonElement;
  wallButton: HTMLButtonElement;
  pusherMenuToggleButton: HTMLButtonElement;
  pusherLibrary: HTMLElement;
  sliderButton: HTMLButtonElement;
  spinnerButton: HTMLButtonElement;
  sweeperButton: HTMLButtonElement;
  gridSnapToggleButton: HTMLButtonElement;
  spawnTypePointButton: HTMLButtonElement;
  spawnTypeTopSliderButton: HTMLButtonElement;
  majorGridToggleButton: HTMLButtonElement;
  minorGridToggleButton: HTMLButtonElement;
  gridOverlay: HTMLElement;
  editorOverlayCanvas: HTMLCanvasElement;
  playButton: HTMLButtonElement;
  playButtonLabel: HTMLElement | null;
  playButtonIcons: SVGElement[];
  resetButton: HTMLButtonElement;
  raceOutcome: HTMLElement;
  raceOutcomeSwatch: HTMLElement;
  raceOutcomeLabel: HTMLElement;
  zoomInButton: HTMLButtonElement;
  zoomOutButton: HTMLButtonElement;
  zoomResetButton: HTMLButtonElement;
  zoomLevelOutput: HTMLOutputElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  teamCountInput: HTMLInputElement;
  teamCountOutput: HTMLOutputElement;
  marblesPerTeamInput: HTMLInputElement;
  marblesPerTeamOutput: HTMLOutputElement;
  releaseIntervalInput: HTMLInputElement;
  releaseIntervalOutput: HTMLOutputElement;
  courseWidthInput: HTMLInputElement;
  courseHeightInput: HTMLInputElement;
  wallThicknessInput: HTMLInputElement;
  objectInspector: HTMLElement;
  objectInspectorTitle: HTMLElement;
  motionTypeSelect: HTMLSelectElement;
  motionControls: HTMLElement;
  motionRangeRow: HTMLElement;
  motionRangeInput: HTMLInputElement;
  motionRangeOutput: HTMLOutputElement;
  motionReverseButton: HTMLButtonElement;
  motionSpeedButtons: HTMLButtonElement[];
  statusOutput: HTMLElement;
};

export const resolveBuilderUi = (
  rootElement: HTMLElement | null
): BuilderUi => {
  const root = requireElement(rootElement, "leg builder");
  const role = <Element extends HTMLElement = HTMLElement>(
    name: string,
    label = name
  ) =>
    requireElement<Element>(
      root.querySelector<HTMLElement>(`[data-role="${name}"]`),
      label
    );
  const playButton = role<HTMLButtonElement>("race-play", "play");
  const raceOutcome = role("race-outcome", "race outcome");
  return {
    root,
    toolbar: role("toolbar", "builder toolbar"),
    raceControls: role("race-controls", "race controls"),
    toolHintOutput: role("tool-hint", "tool hint"),
    tooltip: role("tooltip", "tooltip"),
    tooltipLabel: role("tooltip-label", "tooltip label"),
    tooltipShortcut: role("tooltip-shortcut", "tooltip shortcut"),
    tooltipArrow: role("tooltip-arrow", "tooltip arrow"),
    panButton: role<HTMLButtonElement>("tool-pan", "pan tool"),
    pointerButton: role<HTMLButtonElement>("tool-pointer", "pointer tool"),
    wallButton: role<HTMLButtonElement>("tool-wall", "wall tool"),
    pusherMenuToggleButton: role<HTMLButtonElement>(
      "pusher-menu-toggle",
      "pusher library toggle"
    ),
    pusherLibrary: role("pusher-library", "pusher library"),
    sliderButton: role<HTMLButtonElement>("tool-slider", "slider pusher"),
    spinnerButton: role<HTMLButtonElement>("tool-spinner", "spinner pusher"),
    sweeperButton: role<HTMLButtonElement>("tool-sweeper", "sweeper pusher"),
    gridSnapToggleButton: role<HTMLButtonElement>(
      "grid-snap-toggle",
      "grid snap toggle"
    ),
    spawnTypePointButton: role<HTMLButtonElement>(
      "spawn-type-point",
      "point spawn tab"
    ),
    spawnTypeTopSliderButton: role<HTMLButtonElement>(
      "spawn-type-top-slider",
      "top slider spawn tab"
    ),
    majorGridToggleButton: role<HTMLButtonElement>(
      "major-grid-toggle",
      "major grid toggle"
    ),
    minorGridToggleButton: role<HTMLButtonElement>(
      "minor-grid-toggle",
      "minor grid toggle"
    ),
    gridOverlay: role("grid-overlay", "grid overlay"),
    editorOverlayCanvas: role<HTMLCanvasElement>(
      "editor-overlay",
      "editor overlay"
    ),
    playButton,
    playButtonLabel: playButton.querySelector("[data-race-button-label]"),
    playButtonIcons: Array.from(
      playButton.querySelectorAll<SVGElement>("[data-race-icon]")
    ),
    resetButton: role<HTMLButtonElement>("race-reset", "reset"),
    raceOutcome,
    raceOutcomeSwatch: requireElement(
      raceOutcome.querySelector("[data-race-outcome-swatch]"),
      "race outcome swatch"
    ),
    raceOutcomeLabel: requireElement(
      raceOutcome.querySelector("[data-race-outcome-label]"),
      "race outcome label"
    ),
    zoomInButton: role<HTMLButtonElement>("zoom-in", "zoom in"),
    zoomOutButton: role<HTMLButtonElement>("zoom-out", "zoom out"),
    zoomResetButton: role<HTMLButtonElement>("zoom-reset", "reset zoom"),
    zoomLevelOutput: role<HTMLOutputElement>("zoom-level", "zoom level"),
    undoButton: role<HTMLButtonElement>("undo", "undo"),
    redoButton: role<HTMLButtonElement>("redo", "redo"),
    teamCountInput: role<HTMLInputElement>("team-count", "team count"),
    teamCountOutput: role<HTMLOutputElement>(
      "team-count-output",
      "team count output"
    ),
    marblesPerTeamInput: role<HTMLInputElement>(
      "marbles-per-team",
      "marbles per team"
    ),
    marblesPerTeamOutput: role<HTMLOutputElement>(
      "marbles-per-team-output",
      "marbles per team output"
    ),
    releaseIntervalInput: role<HTMLInputElement>(
      "release-interval",
      "release interval"
    ),
    releaseIntervalOutput: role<HTMLOutputElement>(
      "release-interval-output",
      "release interval output"
    ),
    courseWidthInput: role<HTMLInputElement>("course-width", "course width"),
    courseHeightInput: role<HTMLInputElement>("course-height", "course height"),
    wallThicknessInput: role<HTMLInputElement>(
      "wall-thickness",
      "wall thickness"
    ),
    objectInspector: role("object-inspector", "object inspector"),
    objectInspectorTitle: role(
      "object-inspector-title",
      "object inspector title"
    ),
    motionTypeSelect: role<HTMLSelectElement>("motion-type", "motion type"),
    motionControls: role("motion-controls", "motion controls"),
    motionRangeRow: role("motion-range-row", "motion range row"),
    motionRangeInput: role<HTMLInputElement>("motion-range", "motion range"),
    motionRangeOutput: role<HTMLOutputElement>(
      "motion-range-output",
      "motion range output"
    ),
    motionReverseButton: role<HTMLButtonElement>(
      "motion-reverse",
      "reverse motion"
    ),
    motionSpeedButtons: [
      role<HTMLButtonElement>("motion-speed-slow", "slow motion"),
      role<HTMLButtonElement>("motion-speed-medium", "medium motion"),
      role<HTMLButtonElement>("motion-speed-fast", "fast motion"),
    ],
    statusOutput: role("race-status", "status"),
  };
};
