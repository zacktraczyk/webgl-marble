import { mountScene } from "../mount";
import createScene from "./index";

/** Mounts the race builder page against its Astro chrome. */
export const mountRaceBuilderPage = () => {
  mountScene(createScene());
};
