import { SceneHost, type Scene, type SceneHostOptions } from "./scene";

export interface MountSceneOptions extends SceneHostOptions {
  errorElement?: string | HTMLElement | null;
  showFps?: boolean;
  fpsElement?: string | HTMLElement | null;
}

/** Mounts a browser scene and automatically tears it down on page navigation. */
export const mountScene = (
  scene: Scene,
  {
    errorElement = "error",
    showFps = false,
    fpsElement = "fps",
    ...hostOptions
  }: MountSceneOptions = {}
) => {
  const element =
    typeof errorElement === "string"
      ? document.getElementById(errorElement)
      : errorElement;
  const reportError = (error: unknown) => {
    if (element) {
      element.textContent = `${error}`;
    }
    if (hostOptions.onError) {
      hostOptions.onError(error);
    } else {
      console.error(error);
    }
  };

  const fpsOutput =
    typeof fpsElement === "string"
      ? document.getElementById(fpsElement)
      : fpsElement;
  const externalPerformanceListener = hostOptions.onPerformanceSample;

  const host = new SceneHost(scene, {
    ...hostOptions,
    onError: reportError,
    collectPerformance: showFps || hostOptions.collectPerformance,
    onPerformanceSample: (sample) => {
      if (showFps && fpsOutput) {
        fpsOutput.textContent = `FPS: ${sample.fps.toFixed(2)}`;
      }
      externalPerformanceListener?.(sample);
    },
  });
  window.addEventListener("pagehide", () => host.stop(), { once: true });
  host.start();
  return host;
};
