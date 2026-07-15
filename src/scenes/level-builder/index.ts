import type { Scene } from "../../engine/runtime/scene";
import { LevelBuilderRuntime } from "./runtime";

function createScene(rootElement: HTMLElement | null): Scene {
  let runtime: LevelBuilderRuntime | null = null;

  return {
    load: ({ signal }) => {
      runtime = new LevelBuilderRuntime(rootElement, signal);
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

export default createScene;
