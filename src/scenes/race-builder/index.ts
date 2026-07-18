import type { Scene } from "../../engine/runtime/scene";
import { createRaceBuilder } from "./createRaceBuilder";

export default function createScene(): Scene {
  let dispose = () => {};

  return {
    load: ({ signal }) => {
      dispose = createRaceBuilder(signal);
    },
    dispose: () => dispose(),
  };
}
