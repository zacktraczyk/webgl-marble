import path from "node:path";
import {
  VDU_SCENARIOS,
  type VduPreset,
  type VduRunnerConfig,
  type VduSuite,
} from "./types";

interface PresetValues {
  repetitions: number;
  warmupFrames: number;
  durationMs: number;
  minFrames: number;
  cooldownMs: number;
}

export const VDU_PRESETS: Record<VduPreset, PresetValues> = {
  smoke: {
    repetitions: 1,
    warmupFrames: 60,
    durationMs: 2_000,
    minFrames: 60,
    cooldownMs: 0,
  },
  standard: {
    repetitions: 10,
    warmupFrames: 300,
    durationMs: 10_000,
    minFrames: 600,
    cooldownMs: 2_000,
  },
  confidence: {
    repetitions: 20,
    warmupFrames: 300,
    durationMs: 30_000,
    minFrames: 1_800,
    cooldownMs: 2_000,
  },
};

function parseArgs(argv: string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      parsed.set(rawKey, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed.set(rawKey, next);
      index += 1;
    } else {
      parsed.set(rawKey, true);
    }
  }
  return parsed;
}

function stringOption(
  args: Map<string, string | true>,
  name: string
): string | undefined {
  const value = args.get(name);
  return typeof value === "string" ? value : undefined;
}

function numberOption(
  args: Map<string, string | true>,
  name: string,
  fallback: number
): number {
  const value = stringOption(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number`);
  }
  return parsed;
}

function booleanOption(
  args: Map<string, string | true>,
  name: string,
  fallback: boolean
): boolean {
  if (!args.has(name)) return fallback;
  const value = args.get(name);
  if (value === true) return true;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

export function parseVduConfig(argv: string[]): VduRunnerConfig {
  const args = parseArgs(argv);
  const presetName = stringOption(args, "preset") ?? "standard";
  if (!(presetName in VDU_PRESETS)) {
    throw new Error(`Unknown preset: ${presetName}`);
  }
  const preset = presetName as VduPreset;
  const defaults = VDU_PRESETS[preset];
  const scenario = stringOption(args, "scenario") ?? "contiguous";
  if (!VDU_SCENARIOS.includes(scenario as (typeof VDU_SCENARIOS)[number])) {
    throw new Error(`Unknown VDU scenario: ${scenario}`);
  }

  const baselineUrl = stringOption(args, "baseline-url");
  const candidateUrl = stringOption(args, "candidate-url");
  if ((baselineUrl && !candidateUrl) || (!baselineUrl && candidateUrl)) {
    throw new Error(
      "--baseline-url and --candidate-url must be supplied together"
    );
  }

  const suiteName = stringOption(args, "suite") ?? "single";
  if (
    !(["single", "scaling", "full"] as const).includes(suiteName as VduSuite)
  ) {
    throw new Error(`Unknown suite: ${suiteName}`);
  }
  const countsValue = stringOption(args, "counts");
  const counts = countsValue
    ? countsValue.split(",").map((value) => {
        const parsed = Number(value.trim());
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
          throw new Error(`Invalid --counts entry: ${value}`);
        }
        return parsed;
      })
    : [100, 500, 1_000, 2_500, 5_000];

  const config: VduRunnerConfig = {
    command: "run",
    preset,
    suite: suiteName as VduSuite,
    counts,
    scenario: scenario as VduRunnerConfig["scenario"],
    count: numberOption(
      args,
      "count",
      scenario === "random-balls" || scenario === "full-race" ? 80 : 2_500
    ),
    seed: numberOption(args, "seed", 18_420),
    repetitions: numberOption(args, "repetitions", defaults.repetitions),
    warmupFrames: numberOption(args, "warmup-frames", defaults.warmupFrames),
    durationMs: numberOption(args, "duration-ms", defaults.durationMs),
    minFrames: numberOption(args, "min-frames", defaults.minFrames),
    cooldownMs: numberOption(args, "cooldown-ms", defaults.cooldownMs),
    gpu: booleanOption(args, "gpu", false),
    audit: booleanOption(args, "audit", true),
    visual: booleanOption(args, "visual", true),
    physics: booleanOption(args, "physics", false),
    allowSoftware: booleanOption(args, "allow-software", false),
    headless: booleanOption(args, "headless", Boolean(process.env.CI)),
    url: stringOption(args, "url"),
    baselineUrl,
    candidateUrl,
    chromePath: stringOption(args, "chrome"),
    outputDir:
      stringOption(args, "output-dir") ?? path.resolve("benchmarks/results"),
    label: stringOption(args, "label"),
    improvementThreshold: numberOption(args, "improvement-threshold", 0.1),
    regressionThreshold: numberOption(args, "regression-threshold", 0.05),
  };

  if (!Number.isInteger(config.repetitions) || config.repetitions < 1) {
    throw new Error("--repetitions must be a positive integer");
  }
  if (!Number.isInteger(config.count) || config.count < 1) {
    throw new Error("--count must be a positive integer");
  }
  if (!Number.isInteger(config.warmupFrames) || config.warmupFrames < 1) {
    throw new Error("--warmup-frames must be a positive integer");
  }
  if (!Number.isInteger(config.minFrames) || config.minFrames < 1) {
    throw new Error("--min-frames must be a positive integer");
  }
  return config;
}

export function printVduHelp(): void {
  console.log(`VDU browser benchmark

Usage:
  bun benchmarks/vdu/runner.ts run [options]
  bun benchmarks/vdu/runner.ts compare <baseline.json> <candidate.json>

Run options:
  --preset smoke|standard|confidence   standard
  --scenario <name>                   contiguous
  --count <n>                         2500
  --suite single|scaling|full         single
  --counts 100,500,1000,2500,5000    scaling-suite entity counts
  --seed <n>                          18420
  --url <url>                         use an existing same-build server
  --baseline-url <url>                cross-build baseline server
  --candidate-url <url>               cross-build candidate server
  --repetitions <n>                   override preset
  --warmup-frames <n>                 override preset
  --duration-ms <n>                   override preset
  --min-frames <n>                    override preset
  --cooldown-ms <n>                   override preset
  --gpu[=true|false]                  collect timer-query samples
  --audit[=true|false]                run one-frame GL structural audits
  --visual[=true|false]               compare deterministic canvas output
  --physics[=true|false]              enable physics in full-race
  --headless[=true|false]             headed locally, headless in CI
  --allow-software                    permit SwiftShader/software WebGL
  --chrome <path>                     explicit Chrome executable
  --output-dir <path>                 benchmarks/results
  --label <text>                      result label

Scenarios: ${VDU_SCENARIOS.join(", ")}
`);
}
