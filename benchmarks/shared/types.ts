import type { Browser } from "puppeteer-core";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export interface BenchmarkPreset {
  repetitions: number;
  warmupFrames: number;
  durationMs: number;
  minFrames: number;
  cooldownMs: number;
}

export interface CommonRunnerConfig extends BenchmarkPreset {
  preset: string;
  seed: number;
  headless: boolean;
  executablePath?: string;
  url?: string;
  host: string;
  port?: number;
  outputDir: string;
  build: boolean;
  allowSoftwareRenderer: boolean;
}

export interface PairOrder<TVariant extends string = string> {
  pairIndex: number;
  order: [TVariant, TVariant];
}

export interface SampleSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  standardDeviation: number;
}

export type ComparisonVerdict = "verified" | "inconclusive" | "regression";

export interface PairedComparison {
  pairCount: number;
  baseline: SampleSummary;
  candidate: SampleSummary;
  relativeChanges: number[];
  medianRelativeChange: number;
  meanRelativeChange: number;
  confidenceInterval95: [number, number];
  signFlipPValue: number;
  candidateWins: number;
  candidateLosses: number;
  ties: number;
  verdict: ComparisonVerdict;
}

export interface GitMetadata {
  commit: string | null;
  branch: string | null;
  dirty: boolean | null;
  diffHash: string | null;
}

export interface SystemMetadata {
  platform: NodeJS.Platform;
  release: string;
  architecture: string;
  cpuModel: string | null;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  runtime: string;
  runtimeVersion: string;
  hostname: string;
}

export interface LaunchedBrowser {
  browser: Browser;
  executablePath: string;
}

export interface PreviewServer {
  url: string;
  stop(): Promise<void>;
}

export interface ComparisonTableRow {
  scenario?: string;
  count?: number;
  metric: string;
  baseline: number;
  candidate: number;
  change: number;
  confidenceInterval?: [number, number];
  verdict: string;
}
