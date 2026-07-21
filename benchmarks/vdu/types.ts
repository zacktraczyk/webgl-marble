export const VDU_SCENARIOS = [
  "random-balls",
  "contiguous",
  "grouped-runs",
  "fragmented",
  "unique-meshes",
  "full-race",
] as const;

export type VduScenario = (typeof VDU_SCENARIOS)[number];
export type RendererMode = "auto" | "basic" | "instanced";
export type VduPreset = "smoke" | "standard" | "confidence";
export type VduSuite = "single" | "scaling" | "full";
export type ComparisonMode = "same-build" | "cross-build";
export type VariantName = "basic" | "instanced" | "baseline" | "candidate";

export interface VduRunnerConfig {
  command: "run";
  preset: VduPreset;
  suite: VduSuite;
  counts: number[];
  scenario: VduScenario;
  count: number;
  seed: number;
  repetitions: number;
  warmupFrames: number;
  durationMs: number;
  minFrames: number;
  cooldownMs: number;
  gpu: boolean;
  audit: boolean;
  visual: boolean;
  physics: boolean;
  allowSoftware: boolean;
  headless: boolean;
  url?: string;
  baselineUrl?: string;
  candidateUrl?: string;
  chromePath?: string;
  outputDir: string;
  label?: string;
  improvementThreshold: number;
  regressionThreshold: number;
}

export interface BrowserRunResult {
  startedAt: number;
  wallDurationMs: number;
  measuredFrames: number;
  frameIntervalsMs: number[];
  renderDurationsMs: number[];
  callbackDurationsMs: number[];
  gpuDurationsMs?: number[];
  gpu: {
    requested: boolean;
    supported: boolean;
    validQueries: number;
    discardedQueries: number;
    pendingQueries: number;
  };
}

export interface WarmupResult {
  frames: number;
  durationMs: number;
  nominalFrameIntervalMs: number;
}

export interface BenchmarkMetadata {
  scenario: {
    name: VduScenario;
    count: number;
    seed: number;
    physics: boolean;
    renderer: RendererMode;
  };
  vdu: {
    requestedStrategy: RendererMode;
    activeStrategy: "basic" | "instanced" | "unsupported";
    drawMode: "TRIANGLES" | "LINES";
    instancingSupported: boolean;
  };
  webgl: {
    vendor: string;
    renderer: string;
    unmaskedVendor?: string;
    unmaskedRenderer?: string;
    version: string;
    shadingLanguageVersion: string;
    instancingSupported: boolean;
    gpuTimerSupported: boolean;
  };
  canvas: {
    cssWidth: number;
    cssHeight: number;
    backingWidth: number;
    backingHeight: number;
    devicePixelRatio: number;
  };
  userAgent: string;
}

export interface GlAuditResult {
  totalDrawCalls: number;
  drawArrays: number;
  drawArraysInstanced: number;
  totalInstancesSubmitted: number;
  instanceCounts: number[];
  uniformMatrix3fv: number;
  uniform4fv: number;
  uniform2f: number;
  bindBuffer: number;
  vertexAttribPointer: number;
  bufferData: number;
  bufferDataBytes: number;
  bufferSubData: number;
  bufferSubDataBytes: number;
  useProgram: number;
  clear: number;
  averageBatchSize: number;
  maxBatchSize: number;
}

export interface VisualSnapshot {
  width: number;
  height: number;
  pngDataUrl: string;
}

export interface RunSummary {
  renderCpuMs: SampleSummary;
  callbackCpuMs: SampleSummary;
  frameIntervalMs: SampleSummary;
  gpuMs?: SampleSummary;
  framesOver16_67Ms: number;
  framesOver33_33Ms: number;
  estimatedMissedRefreshes: number;
}

export interface SampleSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface VariantRun {
  pairIndex: number;
  orderIndex: number;
  variant: VariantName;
  url: string;
  renderer: RendererMode;
  warmup: WarmupResult;
  metadata: BenchmarkMetadata;
  raw: BrowserRunResult;
  summary: RunSummary;
}

export interface AuditRecord {
  variant: VariantName;
  renderer: RendererMode;
  metadata: BenchmarkMetadata;
  counters: GlAuditResult;
}

export interface StructuralAssertion {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  note?: string;
}

export interface VisualComparison {
  supported: boolean;
  equivalent?: boolean;
  differingPixels?: number;
  comparedPixels?: number;
  differenceRatio?: number;
  reason?: string;
}

export interface VduBenchmarkResult {
  schemaVersion: 1;
  testName: "vdu";
  label?: string;
  timestamp: string;
  comparisonMode: ComparisonMode;
  config: VduRunnerConfig;
  git: unknown;
  system: unknown;
  browser: unknown;
  pairOrder: Array<{ pairIndex: number; order: [VariantName, VariantName] }>;
  runs: VariantRun[];
  audits: AuditRecord[];
  structuralAssertions: StructuralAssertion[];
  visual?: VisualComparison;
  comparisons: Record<string, unknown>;
  verdict: "verified" | "inconclusive" | "regression" | "unsupported";
}

export interface BenchmarkWindow {
  ready: true;
  metadata(): BenchmarkMetadata;
  warmup(options: { frames: number }): Promise<WarmupResult>;
  run(options: {
    durationMs: number;
    minFrames: number;
    gpu?: boolean;
  }): Promise<BrowserRunResult>;
  audit(): Promise<GlAuditResult>;
  capture(): VisualSnapshot;
  dispose(): void;
}
