import type { SerializedLevel } from "../../game/level/document";
import type { Scene } from "../../engine/runtime/scene";
import { LegBuilderRuntime, type LegBuilderOptions } from "./runtime";

export type { LegBuilderOptions } from "./runtime";

export interface LegBuilderScene extends Scene {
  getLevelSnapshot(): SerializedLevel | null;
}

/** Core leg editor scene — mounts against a root element with optional race wiring. */
export default function createLegBuilder(
  rootElement: HTMLElement | null,
  options: LegBuilderOptions = {}
): LegBuilderScene {
  let runtime: LegBuilderRuntime | null = null;

  return {
    load: ({ signal }) => {
      runtime = new LegBuilderRuntime(rootElement, signal, options);
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
