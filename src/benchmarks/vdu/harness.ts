import type {
  BenchmarkMetadata,
  BenchmarkRunOptions,
  BrowserRunResult,
  VduBenchmarkApi,
  VduScenarioConfig,
  VisualSnapshot,
  WarmupOptions,
  WarmupResult,
} from "../shared/types";
import { auditWebGlFrame } from "./glAudit";
import { GpuTimer, supportsGpuTimer } from "./gpuTimer";
import { createBenchmarkScene } from "./scenarios";

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const positiveInteger = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && value! > 0 ? Math.floor(value!) : fallback;

const nonNegativeInteger = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && value! >= 0 ? Math.floor(value!) : fallback;

const webGlString = (gl: WebGLRenderingContext, key: number) =>
  String(gl.getParameter(key) ?? "unknown");

const collectMetadata = (
  canvas: HTMLCanvasElement,
  config: VduScenarioConfig,
  vduMetadata: BenchmarkMetadata["vdu"]
): BenchmarkMetadata => {
  const gl = canvas.getContext("webgl");
  if (!gl) {
    throw new Error("Benchmark canvas has no WebGL context");
  }
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const unmaskedVendor = debug
    ? webGlString(gl, debug.UNMASKED_VENDOR_WEBGL)
    : undefined;
  const unmaskedRenderer = debug
    ? webGlString(gl, debug.UNMASKED_RENDERER_WEBGL)
    : undefined;
  return {
    scenario: { ...config },
    vdu: { ...vduMetadata },
    webgl: {
      vendor: webGlString(gl, gl.VENDOR),
      renderer: webGlString(gl, gl.RENDERER),
      unmaskedVendor,
      unmaskedRenderer,
      version: webGlString(gl, gl.VERSION),
      shadingLanguageVersion: webGlString(gl, gl.SHADING_LANGUAGE_VERSION),
      instancingSupported: gl.getExtension("ANGLE_instanced_arrays") !== null,
      gpuTimerSupported: supportsGpuTimer(gl),
    },
    canvas: {
      cssWidth: canvas.clientWidth,
      cssHeight: canvas.clientHeight,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    userAgent: navigator.userAgent,
  };
};

const waitForAnimationFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

export const createVduBenchmark = (
  canvas: HTMLCanvasElement,
  config: VduScenarioConfig
): VduBenchmarkApi => {
  const scene = createBenchmarkScene(canvas, config);
  let disposed = false;
  let operationInProgress = false;

  const assertUsable = () => {
    if (disposed) {
      throw new Error("The VDU benchmark has been disposed");
    }
    if (scene.vdu.renderMetadata.activeStrategy === "unsupported") {
      throw new Error(
        "The requested instanced renderer is unsupported in this browser"
      );
    }
  };

  const exclusively = async <Result>(operation: () => Promise<Result>) => {
    assertUsable();
    if (operationInProgress) {
      throw new Error("A VDU benchmark operation is already running");
    }
    operationInProgress = true;
    try {
      return await operation();
    } finally {
      operationInProgress = false;
    }
  };

  const warmup = (options: WarmupOptions = {}): Promise<WarmupResult> =>
    exclusively(async () => {
      const targetFrames = positiveInteger(options.frames, 300);
      const timestamps: number[] = [];
      for (let frame = 0; frame < targetFrames; frame++) {
        const timestamp = await waitForAnimationFrame();
        timestamps.push(timestamp);
        scene.update();
        scene.render();
      }
      const intervals = timestamps
        .slice(1)
        .map((timestamp, index) => timestamp - timestamps[index]);
      return {
        frames: timestamps.length,
        durationMs:
          timestamps.length > 1
            ? timestamps[timestamps.length - 1] - timestamps[0]
            : 0,
        nominalFrameIntervalMs: median(intervals),
      };
    });

  const run = (options: BenchmarkRunOptions = {}): Promise<BrowserRunResult> =>
    exclusively(async () => {
      const durationMs = nonNegativeInteger(options.durationMs, 10_000);
      // Two callbacks are the minimum needed to produce one frame interval.
      const minFrames = Math.max(2, positiveInteger(options.minFrames, 600));
      const gl = canvas.getContext("webgl");
      if (!gl) {
        throw new Error("Benchmark canvas has no WebGL context");
      }
      const gpuTimer = options.gpu ? new GpuTimer(gl) : null;
      const frameIntervalsMs: number[] = [];
      const renderDurationsMs: number[] = [];
      const callbackDurationsMs: number[] = [];
      let firstTimestamp: number | undefined;
      let previousTimestamp: number | undefined;
      let lastTimestamp = 0;

      while (
        firstTimestamp === undefined ||
        lastTimestamp - firstTimestamp < durationMs ||
        renderDurationsMs.length < minFrames
      ) {
        const timestamp = await waitForAnimationFrame();
        const callbackStarted = performance.now();
        firstTimestamp ??= timestamp;
        lastTimestamp = timestamp;
        if (previousTimestamp !== undefined) {
          frameIntervalsMs.push(timestamp - previousTimestamp);
        }
        previousTimestamp = timestamp;

        scene.update();
        gpuTimer?.begin();
        const renderStarted = performance.now();
        scene.render();
        renderDurationsMs.push(performance.now() - renderStarted);
        gpuTimer?.end();
        gpuTimer?.poll();
        callbackDurationsMs.push(performance.now() - callbackStarted);
      }

      await gpuTimer?.drain();
      const gpuDurationsMs = gpuTimer?.durationsMs;
      return {
        startedAt: performance.timeOrigin + (firstTimestamp ?? 0),
        wallDurationMs:
          firstTimestamp === undefined ? 0 : lastTimestamp - firstTimestamp,
        measuredFrames: renderDurationsMs.length,
        frameIntervalsMs,
        renderDurationsMs,
        callbackDurationsMs,
        ...(gpuDurationsMs ? { gpuDurationsMs: [...gpuDurationsMs] } : {}),
        gpu: {
          requested: options.gpu === true,
          supported: gpuTimer?.supported ?? false,
          validQueries: gpuDurationsMs?.length ?? 0,
          discardedQueries: gpuTimer?.discardedQueries ?? 0,
          pendingQueries: gpuTimer?.pendingQueries ?? 0,
        },
      };
    });

  const capture = (): VisualSnapshot => {
    assertUsable();
    if (operationInProgress) {
      throw new Error("Cannot capture during a benchmark operation");
    }
    scene.render();
    return {
      width: canvas.width,
      height: canvas.height,
      pngDataUrl: canvas.toDataURL("image/png"),
    };
  };

  return {
    ready: true,
    metadata: () => collectMetadata(canvas, config, scene.vdu.renderMetadata),
    warmup,
    run,
    audit: () => exclusively(() => auditWebGlFrame(canvas, scene.render)),
    capture,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      scene.dispose();
    },
  };
};
