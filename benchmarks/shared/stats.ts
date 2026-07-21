import type { PairedComparison, SampleSummary } from "./types.ts";

export interface ComparePairedOptions {
  lowerIsBetter?: boolean;
  improvementThreshold?: number;
  regressionTolerance?: number;
  alpha?: number;
  bootstrapSamples?: number;
  permutationSamples?: number;
  seed?: number;
}

function assertFiniteSamples(samples: number[], name: string): void {
  if (samples.length === 0) throw new Error(`${name} must not be empty`);
  if (samples.some((value) => !Number.isFinite(value))) {
    throw new Error(`${name} contains a non-finite value`);
  }
}

export function quantile(sortedSamples: number[], probability: number): number {
  if (sortedSamples.length === 0) throw new Error("samples must not be empty");
  if (probability < 0 || probability > 1) {
    throw new Error("probability must be between 0 and 1");
  }

  const position = (sortedSamples.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;
  return (
    sortedSamples[lowerIndex] * (1 - fraction) +
    sortedSamples[upperIndex] * fraction
  );
}

export function summarize(samples: number[]): SampleSummary {
  assertFiniteSamples(samples, "samples");
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted.at(-1)!,
    mean,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    standardDeviation: Math.sqrt(variance),
  };
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function bootstrapMedianConfidenceInterval(
  values: number[],
  options: { samples?: number; confidence?: number; seed?: number } = {}
): [number, number] {
  assertFiniteSamples(values, "values");
  const sampleCount = options.samples ?? 10_000;
  const confidence = options.confidence ?? 0.95;
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("bootstrap samples must be a positive integer");
  }
  if (confidence <= 0 || confidence >= 1) {
    throw new Error("confidence must be between 0 and 1");
  }

  const random = mulberry32(options.seed ?? 42);
  const medians = new Array<number>(sampleCount);
  const resample = new Array<number>(values.length);
  for (let iteration = 0; iteration < sampleCount; iteration += 1) {
    for (let index = 0; index < values.length; index += 1) {
      resample[index] = values[Math.floor(random() * values.length)];
    }
    resample.sort((a, b) => a - b);
    medians[iteration] = quantile(resample, 0.5);
  }
  medians.sort((a, b) => a - b);

  const tail = (1 - confidence) / 2;
  return [quantile(medians, tail), quantile(medians, 1 - tail)];
}

/** Two-sided paired randomization test using the absolute mean difference. */
export function signFlipPValue(
  differences: number[],
  options: { samples?: number; seed?: number } = {}
): number {
  assertFiniteSamples(differences, "differences");
  const nonZero = differences.filter((value) => value !== 0);
  if (nonZero.length === 0) return 1;

  const observed = Math.abs(
    nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length
  );
  const epsilon = Number.EPSILON * Math.max(1, observed) * 16;

  if (nonZero.length <= 20) {
    const combinations = 2 ** nonZero.length;
    let extreme = 0;
    for (let mask = 0; mask < combinations; mask += 1) {
      let total = 0;
      for (let index = 0; index < nonZero.length; index += 1) {
        total += (mask & (2 ** index)) === 0 ? nonZero[index] : -nonZero[index];
      }
      if (Math.abs(total / nonZero.length) + epsilon >= observed) extreme += 1;
    }
    return extreme / combinations;
  }

  const sampleCount = options.samples ?? 100_000;
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("permutation samples must be a positive integer");
  }
  const random = mulberry32(options.seed ?? 42);
  let extreme = 0;
  for (let iteration = 0; iteration < sampleCount; iteration += 1) {
    let total = 0;
    for (const value of nonZero) total += random() < 0.5 ? value : -value;
    if (Math.abs(total / nonZero.length) + epsilon >= observed) extreme += 1;
  }
  // Add-one correction prevents a zero Monte Carlo p-value.
  return (extreme + 1) / (sampleCount + 1);
}

export function comparePaired(
  baseline: number[],
  candidate: number[],
  options: ComparePairedOptions = {}
): PairedComparison {
  assertFiniteSamples(baseline, "baseline");
  assertFiniteSamples(candidate, "candidate");
  if (baseline.length !== candidate.length) {
    throw new Error(
      "baseline and candidate must contain the same number of pairs"
    );
  }
  if (baseline.some((value) => value === 0)) {
    throw new Error("baseline values must be non-zero for relative comparison");
  }

  const lowerIsBetter = options.lowerIsBetter ?? true;
  const improvementThreshold = options.improvementThreshold ?? 0.1;
  const regressionTolerance = options.regressionTolerance ?? 0.05;
  const alpha = options.alpha ?? 0.05;
  const seed = options.seed ?? 42;

  const relativeChanges = baseline.map(
    (value, index) => (candidate[index] - value) / Math.abs(value)
  );
  const relativeSummary = summarize(relativeChanges);
  const confidenceInterval95 = bootstrapMedianConfidenceInterval(
    relativeChanges,
    {
      samples: options.bootstrapSamples,
      seed,
    }
  );
  const signFlip = signFlipPValue(relativeChanges, {
    samples: options.permutationSamples,
    seed: seed ^ 0x9e3779b9,
  });

  let candidateWins = 0;
  let candidateLosses = 0;
  let ties = 0;
  for (const change of relativeChanges) {
    if (change === 0) ties += 1;
    else if ((lowerIsBetter && change < 0) || (!lowerIsBetter && change > 0)) {
      candidateWins += 1;
    } else candidateLosses += 1;
  }

  let verdict: PairedComparison["verdict"] = "inconclusive";
  if (lowerIsBetter) {
    if (
      relativeSummary.p50 <= -improvementThreshold &&
      confidenceInterval95[1] < 0 &&
      signFlip <= alpha
    ) {
      verdict = "verified";
    } else if (
      relativeSummary.p50 >= regressionTolerance &&
      confidenceInterval95[0] > 0 &&
      signFlip <= alpha
    ) {
      verdict = "regression";
    }
  } else if (
    relativeSummary.p50 >= improvementThreshold &&
    confidenceInterval95[0] > 0 &&
    signFlip <= alpha
  ) {
    verdict = "verified";
  } else if (
    relativeSummary.p50 <= -regressionTolerance &&
    confidenceInterval95[1] < 0 &&
    signFlip <= alpha
  ) {
    verdict = "regression";
  }

  return {
    pairCount: baseline.length,
    baseline: summarize(baseline),
    candidate: summarize(candidate),
    relativeChanges,
    medianRelativeChange: relativeSummary.p50,
    meanRelativeChange: relativeSummary.mean,
    confidenceInterval95,
    signFlipPValue: signFlip,
    candidateWins,
    candidateLosses,
    ties,
    verdict,
  };
}
