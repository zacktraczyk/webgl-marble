import type { Scene } from "../../engine/runtime/scene";
import { LevelBuilderRuntime } from "./runtime";
import type { BuilderElements } from "./types";

function createScene(elementSelectors: BuilderElements): Scene {
  let runtime: LevelBuilderRuntime | null = null;

  return {
    load: ({ signal }) => {
      runtime = new LevelBuilderRuntime(elementSelectors, signal);
    },
    fixedUpdate: (deltaMs) => runtime?.fixedUpdate(deltaMs),
    update: () => runtime?.updateInterface(),
    render: () => runtime?.render(),
    dispose: () => {
      runtime?.dispose();
      runtime = null;
    },
  };
}

export type { BuilderElements } from "./types";
export default createScene;
