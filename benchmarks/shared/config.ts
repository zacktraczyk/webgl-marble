import { resolve } from "node:path";
import type { BenchmarkPreset, CommonRunnerConfig } from "./types.ts";

export const COMMON_PRESETS = {
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
} as const satisfies Record<string, BenchmarkPreset>;

export type ParsedCliArgs = Record<string, string | boolean | string[]> & {
  _: string[];
};

/** Small dependency-free parser for `--key value`, `--key=value`, and flags. */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const parsed: ParsedCliArgs = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const equalIndex = token.indexOf("=");
    const rawKey = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    if (!rawKey) throw new Error("Empty CLI option");

    if (rawKey.startsWith("no-") && equalIndex === -1) {
      assignArg(parsed, rawKey.slice(3), false);
      continue;
    }

    if (equalIndex !== -1) {
      assignArg(parsed, rawKey, token.slice(equalIndex + 1));
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      assignArg(parsed, rawKey, next);
      index += 1;
    } else {
      assignArg(parsed, rawKey, true);
    }
  }

  return parsed;
}

function assignArg(
  parsed: ParsedCliArgs,
  key: string,
  value: string | boolean
): void {
  const existing = parsed[key];
  if (existing === undefined) parsed[key] = value;
  else if (Array.isArray(existing)) existing.push(String(value));
  else parsed[key] = [String(existing), String(value)];
}

export function lastArg(
  args: ParsedCliArgs,
  key: string
): string | boolean | undefined {
  const value = args[key];
  return Array.isArray(value) ? value.at(-1) : value;
}

export function numberArg(
  args: ParsedCliArgs,
  key: string,
  fallback: number,
  constraints: { integer?: boolean; min?: number } = {}
): number {
  const raw = lastArg(args, key);
  if (raw === undefined) return fallback;
  if (typeof raw === "boolean") throw new Error(`--${key} requires a value`);

  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${key} must be a number`);
  if (constraints.integer && !Number.isInteger(value)) {
    throw new Error(`--${key} must be an integer`);
  }
  if (constraints.min !== undefined && value < constraints.min) {
    throw new Error(`--${key} must be at least ${constraints.min}`);
  }
  return value;
}

export function stringArg(
  args: ParsedCliArgs,
  key: string,
  fallback?: string
): string | undefined {
  const raw = lastArg(args, key);
  if (raw === undefined) return fallback;
  if (typeof raw === "boolean") throw new Error(`--${key} requires a value`);
  return raw;
}

export function booleanArg(
  args: ParsedCliArgs,
  key: string,
  fallback: boolean
): boolean {
  const raw = lastArg(args, key);
  if (raw === undefined) return fallback;
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`--${key} must be true or false`);
}

export function resolveCommonConfig(
  args: ParsedCliArgs,
  cwd = process.cwd()
): CommonRunnerConfig {
  const presetName = stringArg(args, "preset", "standard")!;
  const preset = COMMON_PRESETS[presetName as keyof typeof COMMON_PRESETS];
  if (!preset) {
    throw new Error(
      `Unknown preset '${presetName}'. Expected ${Object.keys(COMMON_PRESETS).join(", ")}`
    );
  }

  return {
    preset: presetName,
    repetitions: numberArg(args, "repetitions", preset.repetitions, {
      integer: true,
      min: 1,
    }),
    warmupFrames: numberArg(args, "warmup-frames", preset.warmupFrames, {
      integer: true,
      min: 0,
    }),
    durationMs: numberArg(args, "duration-ms", preset.durationMs, { min: 1 }),
    minFrames: numberArg(args, "min-frames", preset.minFrames, {
      integer: true,
      min: 1,
    }),
    cooldownMs: numberArg(args, "cooldown-ms", preset.cooldownMs, { min: 0 }),
    seed: numberArg(args, "seed", 42, { integer: true, min: 0 }),
    headless: booleanArg(args, "headless", true),
    executablePath: stringArg(args, "browser"),
    url: stringArg(args, "url"),
    host: stringArg(args, "host", "127.0.0.1")!,
    port:
      lastArg(args, "port") === undefined
        ? undefined
        : numberArg(args, "port", 0, { integer: true, min: 1 }),
    outputDir: resolve(
      cwd,
      stringArg(args, "output-dir", "benchmarks/results")!
    ),
    build: booleanArg(args, "build", true),
    allowSoftwareRenderer: booleanArg(args, "allow-software-renderer", false),
  };
}
