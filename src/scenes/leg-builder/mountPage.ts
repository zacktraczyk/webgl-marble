import { mountScene } from "../mount";
import createScene from "./index";

/** Mounts the leg builder page chrome against `#leg-builder`. */
export const mountLegBuilderPage = () => {
  const errorElement = document.getElementById("builder-error");
  try {
    mountScene(createScene(), {
      showFps: true,
      fpsElement: document.getElementById("builder-fps"),
      errorElement,
    });
  } catch (error) {
    if (errorElement) {
      errorElement.textContent = `${error}`;
    }
  }
};
