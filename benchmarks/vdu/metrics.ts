import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { summarize } from "../shared/stats";
import type {
  BrowserRunResult,
  RunSummary,
  SampleSummary,
  VisualComparison,
  VisualSnapshot,
} from "./types";

const VISUAL_COLOR_THRESHOLD = 0.1;
const MAX_VISUAL_DIFFERENCE_RATIO = 0.0001;

function asSampleSummary(samples: number[]): SampleSummary {
  const result = summarize(samples);
  return {
    count: samples.length,
    min: result.min,
    max: result.max,
    mean: result.mean,
    p50: result.p50,
    p95: result.p95,
    p99: result.p99,
  };
}

export function summarizeBrowserRun(
  run: BrowserRunResult,
  nominalFrameIntervalMs: number
): RunSummary {
  const intervals = run.frameIntervalsMs.filter(Number.isFinite);
  const estimatedMissedRefreshes = intervals.reduce(
    (total, interval) =>
      total +
      Math.max(
        Math.round(interval / Math.max(nominalFrameIntervalMs, 1)) - 1,
        0
      ),
    0
  );
  return {
    renderCpuMs: asSampleSummary(run.renderDurationsMs),
    callbackCpuMs: asSampleSummary(run.callbackDurationsMs),
    frameIntervalMs: asSampleSummary(intervals),
    gpuMs:
      run.gpuDurationsMs && run.gpuDurationsMs.length > 0
        ? asSampleSummary(run.gpuDurationsMs)
        : undefined,
    framesOver16_67Ms: intervals.filter((value) => value > 16.67).length,
    framesOver33_33Ms: intervals.filter((value) => value > 33.33).length,
    estimatedMissedRefreshes,
  };
}

export function compareVisualSnapshots(
  baseline: VisualSnapshot,
  candidate: VisualSnapshot
): VisualComparison {
  if (
    baseline.width !== candidate.width ||
    baseline.height !== candidate.height
  ) {
    return {
      supported: true,
      equivalent: false,
      reason: `canvas dimensions differ (${baseline.width}x${baseline.height} vs ${candidate.width}x${candidate.height})`,
    };
  }

  const { baselinePng, candidatePng } = decodeSnapshots(baseline, candidate);
  const comparedPixels = baseline.width * baseline.height;
  const differingPixels = pixelmatch(
    baselinePng.data,
    candidatePng.data,
    undefined,
    baseline.width,
    baseline.height,
    { threshold: VISUAL_COLOR_THRESHOLD, includeAA: false }
  );
  const differenceRatio = differingPixels / comparedPixels;
  const equivalent = differenceRatio <= MAX_VISUAL_DIFFERENCE_RATIO;
  return {
    supported: true,
    equivalent,
    differingPixels,
    comparedPixels,
    differenceRatio,
    reason: equivalent
      ? undefined
      : `canvas pixel difference ${(differenceRatio * 100).toFixed(4)}% exceeds ${(MAX_VISUAL_DIFFERENCE_RATIO * 100).toFixed(4)}% tolerance`,
  };
}

function decodePngDataUrl(dataUrl: string): PNG {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Malformed PNG data URL");
  return PNG.sync.read(Buffer.from(dataUrl.slice(comma + 1), "base64"));
}

function decodeSnapshots(
  baseline: VisualSnapshot,
  candidate: VisualSnapshot
): { baselinePng: PNG; candidatePng: PNG } {
  const baselinePng = decodePngDataUrl(baseline.pngDataUrl);
  const candidatePng = decodePngDataUrl(candidate.pngDataUrl);
  if (
    baselinePng.width !== baseline.width ||
    baselinePng.height !== baseline.height ||
    candidatePng.width !== candidate.width ||
    candidatePng.height !== candidate.height
  ) {
    throw new Error("Captured PNG dimensions do not match snapshot metadata");
  }
  return { baselinePng, candidatePng };
}

export function createVisualDiffPng(
  baseline: VisualSnapshot,
  candidate: VisualSnapshot
): Uint8Array {
  if (
    baseline.width !== candidate.width ||
    baseline.height !== candidate.height
  ) {
    throw new Error(
      "Cannot create a visual diff for different canvas dimensions"
    );
  }
  const { baselinePng, candidatePng } = decodeSnapshots(baseline, candidate);
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  pixelmatch(
    baselinePng.data,
    candidatePng.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold: VISUAL_COLOR_THRESHOLD, includeAA: false }
  );
  return PNG.sync.write(diff);
}
