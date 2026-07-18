import { mountScene, type MountSceneOptions } from "../engine/runtime/mountScene";
import type { Scene } from "../engine/runtime/scene";

/** Mounts a /dev demo with shared error reporting against `#error`. */
export function mountDevScene(
  scene: Scene,
  options: MountSceneOptions = {}
) {
  try {
    return mountScene(scene, { showFps: true, ...options });
  } catch (error) {
    const errorElem = document.getElementById("error");
    if (errorElem) {
      errorElem.textContent = `${error}`;
    }
    throw error;
  }
}
