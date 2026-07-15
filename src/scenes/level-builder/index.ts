import type { SerializedLevel } from "../../editor/levelDocument";
import type { Scene } from "../../engine/runtime/scene";
import { LevelBuilderRuntime, type LevelBuilderOptions } from "./runtime";

export type { LevelBuilderOptions } from "./runtime";

export interface LevelBuilderScene extends Scene {
  getLevelSnapshot(): SerializedLevel | null;
}

function createScene(
  rootElement: HTMLElement | null,
  options: LevelBuilderOptions = {}
): LevelBuilderScene {
  let runtime: LevelBuilderRuntime | null = null;

  return {
    load: ({ signal }) => {
      runtime = new LevelBuilderRuntime(rootElement, signal, options);
    },
    fixedUpdate: (deltaMs) => runtime?.fixedUpdate(deltaMs),
    update: () => runtime?.updateInterface(),
    render: () => runtime?.render(),
    getLevelSnapshot: () => runtime?.levelSnapshot ?? null,
    dispose: () => {
      runtime?.dispose();
      runtime = null;
    },
  };
}

export default createScene;
