#!/usr/bin/env bun

import process from "node:process";
import type { Browser, Page } from "puppeteer-core";
import { launchBrowser } from "../shared/browser";
import { collectGitMetadata } from "../shared/git";
import {
  collectBrowserMetadata,
  collectSystemMetadata,
} from "../shared/metadata";
import { createBalancedPairOrder } from "../shared/sequence";
import {
  startPreviewServer,
  type StartPreviewServerOptions,
} from "../shared/server";
import { comparePaired } from "../shared/stats";
import { parseVduConfig, printVduHelp } from "./config";
import { evaluateStructuralAssertions } from "./expectations";
import { compareVisualSnapshots, summarizeBrowserRun } from "./metrics";
import {
  loadVduResult,
  printAssertions,
  printFinalComparison,
  printRun,
  saveVduResult,
  saveVisualArtifacts,
} from "./report";
import type {
  AuditRecord,
  BenchmarkMetadata,
  BrowserRunResult,
  RendererMode,
  VduBenchmarkResult,
  VduRunnerConfig,
  VariantName,
  VariantRun,
  VisualComparison,
  VisualSnapshot,
  WarmupResult,
} from "./types";

const BENCHMARK_PATH = "/dev/benchmark-vdu";

interface VariantDefinition {
  name: VariantName;
  url: string;
  renderer: RendererMode;
}

interface ServerResources {
  baseUrl: string;
  stop(): Promise<void>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function benchmarkUrl(
  baseUrl: string,
  config: VduRunnerConfig,
  renderer: RendererMode
): string {
  const url = new URL(BENCHMARK_PATH, ensureTrailingSlash(baseUrl));
  url.searchParams.set("scenario", config.scenario);
  url.searchParams.set("count", String(config.count));
  url.searchParams.set("seed", String(config.seed));
  url.searchParams.set("renderer", renderer);
  url.searchParams.set("physics", String(config.physics));
  return url.toString();
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

async function resolveServer(
  config: VduRunnerConfig
): Promise<ServerResources> {
  if (config.url) {
    return { baseUrl: config.url, stop: async () => undefined };
  }
  const options: StartPreviewServerOptions = {
    cwd: process.cwd(),
    build: true,
  };
  const preview = await startPreviewServer(options);
  return { baseUrl: preview.url, stop: preview.stop };
}

function variantsFor(
  config: VduRunnerConfig,
  sameBuildUrl: string
): { baseline: VariantDefinition; candidate: VariantDefinition } {
  if (config.baselineUrl && config.candidateUrl) {
    return {
      baseline: { name: "baseline", url: config.baselineUrl, renderer: "auto" },
      candidate: {
        name: "candidate",
        url: config.candidateUrl,
        renderer: "auto",
      },
    };
  }
  return {
    baseline: { name: "basic", url: sameBuildUrl, renderer: "basic" },
    candidate: {
      name: "instanced",
      url: sameBuildUrl,
      renderer: "instanced",
    },
  };
}

async function openBenchmarkPage(
  browser: Browser,
  config: VduRunnerConfig,
  variant: VariantDefinition
): Promise<Page> {
  const page = await browser.newPage();
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warn") {
      diagnostics.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) =>
    diagnostics.push(
      `page error: ${error instanceof Error ? error.message : String(error)}`
    )
  );
  page.setDefaultTimeout(
    Math.max(60_000, config.durationMs + config.minFrames * 50 + 30_000)
  );
  const url = benchmarkUrl(variant.url, config, variant.renderer);
  await page.goto(url, { waitUntil: "networkidle0" });
  try {
    await page.waitForFunction(
      () =>
        Boolean(window.__BENCHMARK__?.ready) ||
        Boolean(window.__BENCHMARK_ERROR__),
      { polling: 50 }
    );
  } catch (error) {
    await page.close().catch(() => undefined);
    const detail = diagnostics.length
      ? `\n${diagnostics.join("\n")}`
      : "\nNo page errors were reported.";
    throw new Error(`Benchmark API did not become ready at ${url}.${detail}`, {
      cause: error,
    });
  }
  const error = await page.evaluate(() => window.__BENCHMARK_ERROR__);
  if (error) {
    await page.close();
    throw new Error(`Benchmark page failed: ${error}`);
  }
  return page;
}

async function pageMetadata(page: Page): Promise<BenchmarkMetadata> {
  return page.evaluate(() => {
    if (!window.__BENCHMARK__) throw new Error("Benchmark API is unavailable");
    return window.__BENCHMARK__.metadata();
  }) as Promise<BenchmarkMetadata>;
}

async function pageWarmup(page: Page, frames: number): Promise<WarmupResult> {
  return page.evaluate(async (warmupFrames) => {
    if (!window.__BENCHMARK__) throw new Error("Benchmark API is unavailable");
    return window.__BENCHMARK__.warmup({ frames: warmupFrames });
  }, frames) as Promise<WarmupResult>;
}

async function pageRun(
  page: Page,
  config: VduRunnerConfig
): Promise<BrowserRunResult> {
  return page.evaluate(
    async (options) => {
      if (!window.__BENCHMARK__)
        throw new Error("Benchmark API is unavailable");
      return window.__BENCHMARK__.run(options);
    },
    {
      durationMs: config.durationMs,
      minFrames: config.minFrames,
      gpu: config.gpu,
    }
  ) as Promise<BrowserRunResult>;
}

function softwareRenderer(metadata: BenchmarkMetadata): string | undefined {
  const renderer = `${metadata.webgl.renderer} ${metadata.webgl.unmaskedRenderer ?? ""}`;
  return /swiftshader|llvmpipe|software rasterizer/i.test(renderer)
    ? renderer.trim()
    : undefined;
}

async function runVariant(
  browser: Browser,
  config: VduRunnerConfig,
  variant: VariantDefinition,
  pairIndex: number,
  orderIndex: number
): Promise<VariantRun> {
  const page = await openBenchmarkPage(browser, config, variant);
  try {
    const metadata = await pageMetadata(page);
    const software = softwareRenderer(metadata);
    if (software && !config.allowSoftware) {
      throw new Error(
        `Software WebGL renderer detected (${software}). Re-run with --allow-software if intentional.`
      );
    }
    if (
      variant.renderer === "instanced" &&
      metadata.vdu.activeStrategy === "unsupported"
    ) {
      throw new Error(
        "ANGLE_instanced_arrays is unavailable for the instanced variant"
      );
    }

    const warmup = await pageWarmup(page, config.warmupFrames);
    const raw = await pageRun(page, config);
    const result: VariantRun = {
      pairIndex,
      orderIndex,
      variant: variant.name,
      url: variant.url,
      renderer: variant.renderer,
      warmup,
      metadata,
      raw,
      summary: summarizeBrowserRun(raw, warmup.nominalFrameIntervalMs),
    };
    printRun(result);
    return result;
  } finally {
    await page
      .evaluate(() => window.__BENCHMARK__?.dispose())
      .catch(() => undefined);
    await page.close();
  }
}

async function auditVariant(
  browser: Browser,
  config: VduRunnerConfig,
  variant: VariantDefinition
): Promise<{ audit?: AuditRecord; visual?: VisualSnapshot }> {
  const page = await openBenchmarkPage(browser, config, variant);
  try {
    const metadata = await pageMetadata(page);
    await pageWarmup(page, config.warmupFrames);
    const counters = config.audit
      ? ((await page.evaluate(async () => {
          if (!window.__BENCHMARK__) {
            throw new Error("Benchmark API is unavailable");
          }
          return window.__BENCHMARK__.audit();
        })) as AuditRecord["counters"])
      : undefined;
    const visual = config.visual
      ? ((await page.evaluate(() => {
          if (!window.__BENCHMARK__) {
            throw new Error("Benchmark API is unavailable");
          }
          return window.__BENCHMARK__.capture();
        })) as VisualSnapshot)
      : undefined;
    return {
      audit: counters
        ? {
            variant: variant.name,
            renderer: variant.renderer,
            metadata,
            counters,
          }
        : undefined,
      visual,
    };
  } finally {
    await page
      .evaluate(() => window.__BENCHMARK__?.dispose())
      .catch(() => undefined);
    await page.close();
  }
}

function pairedValues(
  runs: VariantRun[],
  variant: VariantName,
  extract: (run: VariantRun) => number
): number[] {
  return runs
    .filter((run) => run.variant === variant)
    .sort((left, right) => left.pairIndex - right.pairIndex)
    .map(extract);
}

function buildComparisons(
  runs: VariantRun[],
  baseline: VariantName,
  candidate: VariantName,
  config: VduRunnerConfig
): Record<string, unknown> {
  const metrics: Array<[string, (run: VariantRun) => number]> = [
    ["Render CPU p50", (run) => run.summary.renderCpuMs.p50],
    ["Render CPU p95", (run) => run.summary.renderCpuMs.p95],
    ["Render CPU p99", (run) => run.summary.renderCpuMs.p99],
    ["Callback CPU p95", (run) => run.summary.callbackCpuMs.p95],
    ["Frame interval p95", (run) => run.summary.frameIntervalMs.p95],
  ];
  if (runs.every((run) => run.summary.gpuMs)) {
    metrics.push(["GPU p95", (run) => run.summary.gpuMs!.p95]);
  }

  return Object.fromEntries(
    metrics.map(([name, extract], index) => [
      name,
      comparePaired(
        pairedValues(runs, baseline, extract),
        pairedValues(runs, candidate, extract),
        {
          lowerIsBetter: true,
          improvementThreshold: config.improvementThreshold,
          regressionTolerance: config.regressionThreshold,
          seed: config.seed + index,
        }
      ),
    ])
  );
}

function finalVerdict(
  comparisons: Record<string, unknown>,
  assertionsPassed: boolean,
  visualPassed: boolean,
  candidateMetadata: BenchmarkMetadata
): VduBenchmarkResult["verdict"] {
  if (candidateMetadata.vdu.activeStrategy === "unsupported")
    return "unsupported";
  if (!assertionsPassed || !visualPassed) return "regression";
  const primary = comparisons["Render CPU p95"] as
    | { verdict?: VduBenchmarkResult["verdict"] }
    | undefined;
  return primary?.verdict ?? "inconclusive";
}

async function runBenchmarkCase(
  config: VduRunnerConfig,
  browser: Browser,
  executablePath: string,
  browserMetadata: unknown,
  sameBuildUrl: string
): Promise<VduBenchmarkResult> {
  const variants = variantsFor(config, sameBuildUrl);
  const pairOrder = createBalancedPairOrder(
    config.repetitions,
    config.seed,
    variants.baseline.name,
    variants.candidate.name
  );
  const variantByName = new Map<VariantName, VariantDefinition>([
    [variants.baseline.name, variants.baseline],
    [variants.candidate.name, variants.candidate],
  ]);

  console.log("\nVDU browser benchmark");
  console.log(
    `  ${config.scenario} (${config.count}) · ${config.preset} · ${config.repetitions} paired repetitions`
  );
  console.log(
    `  ${config.warmupFrames} warmup frames/page · ${config.durationMs / 1_000}s measured · min ${config.minFrames} frames`
  );

  const runs: VariantRun[] = [];
  const audits: AuditRecord[] = [];
  let baselineVisual: VisualSnapshot | undefined;
  let candidateVisual: VisualSnapshot | undefined;
  if (config.audit || config.visual) {
    console.log("\nCorrectness and structural pass");
    const first = await auditVariant(browser, config, variants.baseline);
    const second = await auditVariant(browser, config, variants.candidate);
    if (first.audit) audits.push(first.audit);
    if (second.audit) audits.push(second.audit);
    baselineVisual = first.visual;
    candidateVisual = second.visual;
  }

  for (const pair of pairOrder) {
    console.log(
      `\nPair ${pair.pairIndex + 1}/${pairOrder.length}: ${pair.order.join(" -> ")}`
    );
    for (let orderIndex = 0; orderIndex < pair.order.length; orderIndex += 1) {
      const name = pair.order[orderIndex];
      const definition = variantByName.get(name);
      if (!definition) throw new Error(`Unknown pair variant: ${name}`);
      runs.push(
        await runVariant(
          browser,
          config,
          definition,
          pair.pairIndex,
          orderIndex
        )
      );
      if (
        config.cooldownMs > 0 &&
        !(pair === pairOrder.at(-1) && orderIndex === 1)
      ) {
        await delay(config.cooldownMs);
      }
    }
  }

  const structuralAssertions = evaluateStructuralAssertions(config, audits);
  const visual: VisualComparison | undefined =
    baselineVisual && candidateVisual
      ? compareVisualSnapshots(baselineVisual, candidateVisual)
      : config.visual
        ? { supported: false, reason: "visual snapshots were not available" }
        : undefined;
  if (
    visual &&
    visual.equivalent === false &&
    baselineVisual &&
    candidateVisual
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const artifacts = await saveVisualArtifacts(
      config.outputDir,
      `${timestamp}-vdu-${config.scenario}-${config.count}`,
      baselineVisual,
      candidateVisual
    );
    visual.reason =
      `${visual.reason}; baseline ${artifacts.baseline}, ` +
      `candidate ${artifacts.candidate}, diff ${artifacts.diff}`;
  }

  const comparisons = buildComparisons(
    runs,
    variants.baseline.name,
    variants.candidate.name,
    config
  );
  const candidateMetadata =
    audits.find((item) => item.variant === variants.candidate.name)?.metadata ??
    runs.find((item) => item.variant === variants.candidate.name)!.metadata;
  const verdict = finalVerdict(
    comparisons,
    structuralAssertions.every((item) => item.passed),
    visual?.equivalent !== false && visual?.supported !== false,
    candidateMetadata
  );

  const result: VduBenchmarkResult = {
    schemaVersion: 1,
    testName: "vdu",
    label: config.label,
    timestamp: new Date().toISOString(),
    comparisonMode:
      config.baselineUrl && config.candidateUrl ? "cross-build" : "same-build",
    config,
    git: collectGitMetadata(process.cwd()),
    system: collectSystemMetadata(),
    browser: { ...((browserMetadata ?? {}) as object), executablePath },
    pairOrder,
    runs,
    audits,
    structuralAssertions,
    visual,
    comparisons,
    verdict,
  };

  printAssertions(structuralAssertions);
  printFinalComparison(result);
  const saved = await saveVduResult(result);
  console.log(`\nSaved ${saved}`);
  return result;
}

const FULL_SUITE_COUNTS: Record<VduRunnerConfig["scenario"], number> = {
  "random-balls": 80,
  contiguous: 2_500,
  "grouped-runs": 2_500,
  fragmented: 2_500,
  "unique-meshes": 1_000,
  "full-race": 80,
};

function expandSuite(config: VduRunnerConfig): VduRunnerConfig[] {
  if (config.suite === "single") return [config];
  if (config.suite === "scaling") {
    return config.counts.map((count) => ({ ...config, count }));
  }
  return Object.entries(FULL_SUITE_COUNTS).flatMap(([scenario, count]) => {
    const benchmarkCase = {
      ...config,
      scenario: scenario as VduRunnerConfig["scenario"],
      count,
    };
    return scenario === "full-race"
      ? [
          { ...benchmarkCase, physics: false },
          { ...benchmarkCase, physics: true },
        ]
      : [benchmarkCase];
  });
}

async function runBenchmark(): Promise<void> {
  const config = parseVduConfig(process.argv.slice(3));
  const cases = expandSuite(config);
  let server: ServerResources | undefined;
  let launched: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  try {
    if (!(config.baselineUrl && config.candidateUrl)) {
      server = await resolveServer(config);
    }
    const sameBuildUrl = server?.baseUrl ?? config.baselineUrl!;
    launched = await launchBrowser({
      executablePath: config.chromePath,
      headless: config.headless,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    });
    const browserMetadata = await collectBrowserMetadata(launched.browser);
    if (cases.length > 1) {
      console.log(
        `\nRunning ${config.suite} suite (${cases.length} benchmark cases)`
      );
    }
    for (const benchmarkCase of cases) {
      await runBenchmarkCase(
        benchmarkCase,
        launched.browser,
        launched.executablePath,
        browserMetadata,
        sameBuildUrl
      );
    }
  } finally {
    await launched?.browser.close();
    await server?.stop();
  }
}

function candidateP95(result: VduBenchmarkResult): number[] {
  const preferred =
    result.comparisonMode === "same-build" ? "instanced" : "candidate";
  return result.runs
    .filter((run) => run.variant === preferred)
    .sort((left, right) => left.pairIndex - right.pairIndex)
    .map((run) => run.summary.renderCpuMs.p95);
}

async function compareResultFiles(files: string[]): Promise<void> {
  if (files.length !== 2) {
    throw new Error("compare requires <baseline.json> and <candidate.json>");
  }
  const [baseline, candidate] = await Promise.all(files.map(loadVduResult));
  const baselineSamples = candidateP95(baseline);
  const candidateSamples = candidateP95(candidate);
  if (baselineSamples.length !== candidateSamples.length) {
    throw new Error(
      `Result files have different repetition counts (${baselineSamples.length} and ${candidateSamples.length})`
    );
  }
  const comparison = comparePaired(baselineSamples, candidateSamples, {
    lowerIsBetter: true,
    improvementThreshold: candidate.config.improvementThreshold,
    regressionTolerance: candidate.config.regressionThreshold,
    seed: candidate.config.seed,
  });
  console.log("\nVDU result-file comparison (candidate renderer CPU p95)");
  console.log(`  baseline:  ${baseline.label ?? baseline.timestamp}`);
  console.log(`  candidate: ${candidate.label ?? candidate.timestamp}`);
  console.log(
    `  ${comparison.baseline.p50.toFixed(3)}ms -> ${comparison.candidate.p50.toFixed(3)}ms ` +
      `(${(comparison.medianRelativeChange * 100).toFixed(1)}%), ` +
      `95% CI ${(comparison.confidenceInterval95[0] * 100).toFixed(1)}% to ` +
      `${(comparison.confidenceInterval95[1] * 100).toFixed(1)}%, ${comparison.verdict}`
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "run") {
    await runBenchmark();
    return;
  }
  if (command === "compare") {
    await compareResultFiles(process.argv.slice(3));
    return;
  }
  if (command === "--help" || command === "-h" || command === undefined) {
    printVduHelp();
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error("VDU benchmark failed:", error);
  process.exitCode = 1;
});
