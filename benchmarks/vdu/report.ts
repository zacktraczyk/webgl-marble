import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { printComparisonTable, saveJsonResult } from "../shared/report";
import { createVisualDiffPng } from "./metrics";
import type {
  StructuralAssertion,
  VduBenchmarkResult,
  VariantRun,
  VisualSnapshot,
} from "./types";

const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

export function printRun(run: VariantRun): void {
  const summary = run.summary;
  const gpu = summary.gpuMs ? ` GPU p95 ${summary.gpuMs.p95.toFixed(3)}ms` : "";
  console.log(
    `  ${run.variant.padEnd(9)} render p50 ${summary.renderCpuMs.p50.toFixed(3)}ms ` +
      `p95 ${summary.renderCpuMs.p95.toFixed(3)}ms frame p95 ` +
      `${summary.frameIntervalMs.p95.toFixed(2)}ms${gpu}`
  );
}

export function printAssertions(assertions: StructuralAssertion[]): void {
  if (assertions.length === 0) return;
  console.log("\nStructural audit");
  for (const item of assertions) {
    const color = item.passed ? GREEN : RED;
    const mark = item.passed ? "PASS" : "FAIL";
    console.log(
      `  ${color}${mark}${RESET} ${item.name}: ${item.actual} ${DIM}(expected ${item.expected})${RESET}`
    );
  }
}

export function printFinalComparison(result: VduBenchmarkResult): void {
  const rows = Object.entries(result.comparisons).map(
    ([metric, comparison]) => {
      const value = comparison as Record<string, unknown>;
      const baseline = value.baseline as Record<string, unknown> | undefined;
      const candidate = value.candidate as Record<string, unknown> | undefined;
      return {
        scenario: result.config.scenario,
        count: result.config.count,
        metric,
        baseline: Number(baseline?.p50 ?? Number.NaN),
        candidate: Number(candidate?.p50 ?? Number.NaN),
        change: Number(value.medianRelativeChange ?? Number.NaN),
        confidenceInterval: Array.isArray(value.confidenceInterval95)
          ? (value.confidenceInterval95 as [number, number])
          : ([Number.NaN, Number.NaN] as [number, number]),
        verdict: String(value.verdict ?? "inconclusive"),
      };
    }
  );
  printComparisonTable(rows);
  const color =
    result.verdict === "verified"
      ? GREEN
      : result.verdict === "regression" || result.verdict === "unsupported"
        ? RED
        : YELLOW;
  console.log(`\nVerdict: ${color}${result.verdict}${RESET}`);
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Malformed PNG data URL");
  return Uint8Array.from(Buffer.from(dataUrl.slice(comma + 1), "base64"));
}

export async function saveVisualArtifacts(
  outputDir: string,
  prefix: string,
  baseline: VisualSnapshot,
  candidate: VisualSnapshot
): Promise<{ baseline: string; candidate: string; diff: string }> {
  await mkdir(outputDir, { recursive: true });
  const baselinePath = path.join(outputDir, `${prefix}-baseline.png`);
  const candidatePath = path.join(outputDir, `${prefix}-candidate.png`);
  const diffPath = path.join(outputDir, `${prefix}-diff.png`);
  await Promise.all([
    writeFile(baselinePath, decodeDataUrl(baseline.pngDataUrl)),
    writeFile(candidatePath, decodeDataUrl(candidate.pngDataUrl)),
    writeFile(diffPath, createVisualDiffPng(baseline, candidate)),
  ]);
  return { baseline: baselinePath, candidate: candidatePath, diff: diffPath };
}

export async function saveVduResult(
  result: VduBenchmarkResult
): Promise<string> {
  return saveJsonResult(result, {
    outputDir: result.config.outputDir,
    prefix: `vdu-${result.config.scenario}-${result.config.count}`,
  });
}

export async function loadVduResult(file: string): Promise<VduBenchmarkResult> {
  return JSON.parse(await readFile(file, "utf8")) as VduBenchmarkResult;
}
