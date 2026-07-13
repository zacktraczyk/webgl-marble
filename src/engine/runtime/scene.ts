export interface SceneContext {
  /** Aborted when the scene is stopped or replaced. */
  readonly signal: AbortSignal;
}

export interface Scene {
  load?(context: SceneContext): void;
  fixedUpdate?(deltaMs: number): void;
  update?(deltaMs: number, interpolation: number): void;
  render?(interpolation: number): void;
  dispose?(): void;
}

export interface FrameScheduler {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

const browserFrameScheduler: FrameScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface SceneHostOptions {
  fixedDeltaMs?: number;
  maxFrameDeltaMs?: number;
  maxSubSteps?: number;
  scheduler?: FrameScheduler;
  onError?: (error: unknown) => void;
  collectPerformance?: boolean;
  performanceSampleIntervalMs?: number;
  onPerformanceSample?: (sample: ScenePerformanceSample) => void;
}

export interface ScenePerformanceSample {
  fps: number;
  averageFrameMs: number;
  fixedSteps: number;
}

/** Owns frame timing and guarantees a scene's load/start/stop/dispose lifecycle. */
export class SceneHost {
  private readonly _scene: Scene;
  private readonly _fixedDeltaMs: number;
  private readonly _maxFrameDeltaMs: number;
  private readonly _maxSubSteps: number;
  private readonly _scheduler: FrameScheduler;
  private readonly _onError: (error: unknown) => void;
  private readonly _collectPerformance: boolean;
  private readonly _performanceSampleIntervalMs: number;
  private readonly _onPerformanceSample?: (
    sample: ScenePerformanceSample
  ) => void;

  private _abortController: AbortController | null = null;
  private _frameHandle: number | null = null;
  private _lastTime = 0;
  private _accumulator = 0;
  private _running = false;
  private _disposed = false;
  private _performanceElapsed = 0;
  private _performanceFrames = 0;
  private _performanceFixedSteps = 0;

  constructor(scene: Scene, options: SceneHostOptions = {}) {
    this._scene = scene;
    this._fixedDeltaMs = options.fixedDeltaMs ?? 1000 / 60;
    this._maxFrameDeltaMs = options.maxFrameDeltaMs ?? 100;
    this._maxSubSteps = options.maxSubSteps ?? 8;
    this._scheduler = options.scheduler ?? browserFrameScheduler;
    this._onError =
      options.onError ??
      ((error) => {
        console.error(error);
      });
    this._collectPerformance = options.collectPerformance ?? false;
    this._performanceSampleIntervalMs =
      options.performanceSampleIntervalMs ?? 500;
    this._onPerformanceSample = options.onPerformanceSample;
  }

  start() {
    if (this._disposed) {
      throw new Error("Cannot restart a disposed scene host");
    }
    if (this._running) {
      return this;
    }

    this._abortController = new AbortController();
    try {
      this._scene.load?.({ signal: this._abortController.signal });
    } catch (error) {
      this._onError(error);
      this._abortController.abort();
      this._abortController = null;
      this._scene.dispose?.();
      this._disposed = true;
      return this;
    }
    this._lastTime = this._scheduler.now();
    this._accumulator = 0;
    this._performanceElapsed = 0;
    this._performanceFrames = 0;
    this._performanceFixedSteps = 0;
    this._running = true;
    this._frameHandle = this._scheduler.request(this._frame);
    return this;
  }

  stop() {
    if (this._disposed) {
      return;
    }
    this._running = false;
    if (this._frameHandle !== null) {
      this._scheduler.cancel(this._frameHandle);
      this._frameHandle = null;
    }
    this._abortController?.abort();
    this._abortController = null;
    this._scene.dispose?.();
    this._disposed = true;
  }

  get running() {
    return this._running;
  }

  private readonly _frame = (time: number) => {
    if (!this._running) {
      return;
    }

    try {
      const rawElapsed = Math.max(time - this._lastTime, 0);
      const elapsed = Math.min(rawElapsed, this._maxFrameDeltaMs);
      this._lastTime = time;
      this._accumulator += elapsed;

      let steps = 0;
      while (
        this._accumulator >= this._fixedDeltaMs &&
        steps < this._maxSubSteps
      ) {
        this._scene.fixedUpdate?.(this._fixedDeltaMs);
        this._accumulator -= this._fixedDeltaMs;
        steps++;
      }

      if (steps === this._maxSubSteps) {
        this._accumulator = Math.min(this._accumulator, this._fixedDeltaMs);
      }

      const interpolation = this._accumulator / this._fixedDeltaMs;
      this._scene.update?.(elapsed, interpolation);
      this._scene.render?.(interpolation);
      this._recordPerformance(rawElapsed, steps);
      this._frameHandle = this._scheduler.request(this._frame);
    } catch (error) {
      this._onError(error);
      this.stop();
    }
  };

  private _recordPerformance(elapsed: number, fixedSteps: number) {
    if (!this._collectPerformance) {
      return;
    }
    this._performanceElapsed += elapsed;
    this._performanceFrames++;
    this._performanceFixedSteps += fixedSteps;
    if (this._performanceElapsed < this._performanceSampleIntervalMs) {
      return;
    }

    this._onPerformanceSample?.({
      fps: (this._performanceFrames / this._performanceElapsed) * 1000,
      averageFrameMs: this._performanceElapsed / this._performanceFrames,
      fixedSteps: this._performanceFixedSteps,
    });
    this._performanceElapsed = 0;
    this._performanceFrames = 0;
    this._performanceFixedSteps = 0;
  }
}
