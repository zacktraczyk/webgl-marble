import type { Scene } from "../../engine/runtime/scene";
import type { RaceDocument } from "../../races/types";
import { RacePlayerRuntime, type RacePlayerOptions } from "./runtime";

export type { RacePlayerOptions } from "./runtime";
export {
  DEFAULT_MAXIMUM_LEG_DURATION_MS,
  RacePlayerRuntime,
} from "./runtime";
export {
  fallbackEliminationIndex,
  RaceProgression,
  type EliminationResult,
  type RaceProgressionSnapshot,
} from "./progression";

export interface RacePlayerScene extends Scene {
  togglePause(): void;
  restart(): void;
  skipOrContinue(): void;
}

function createScene(
  raceDocument: RaceDocument,
  rootElement: HTMLElement | null,
  options: RacePlayerOptions = {}
): RacePlayerScene {
  let runtime: RacePlayerRuntime | null = null;

  return {
    load: ({ signal }) => {
      runtime = new RacePlayerRuntime(
        raceDocument,
        rootElement,
        signal,
        options
      );
    },
    fixedUpdate: (deltaMs) => runtime?.fixedUpdate(deltaMs),
    update: (deltaMs) => runtime?.update(deltaMs),
    render: () => runtime?.render(),
    togglePause: () => runtime?.togglePause(),
    restart: () => runtime?.restart(),
    skipOrContinue: () => runtime?.skipOrContinue(),
    dispose: () => {
      runtime?.dispose();
      runtime = null;
    },
  };
}

export default createScene;
