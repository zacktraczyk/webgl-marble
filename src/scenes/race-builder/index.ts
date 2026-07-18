import type { Scene } from "../../engine/runtime/scene";
import { initializeRaceBuilder } from "./initialize";

export default function createScene(): Scene {
  let dispose = () => {};

  return {
    load: ({ signal }) => {
      dispose = initializeRaceBuilder(signal);
    },
    dispose: () => dispose(),
  };
}
