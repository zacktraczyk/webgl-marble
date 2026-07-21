import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComparisonTableRow } from "./types.ts";

export interface SaveJsonResultOptions {
  outputDir: string;
  prefix?: string;
  timestamp?: Date;
}

function safeSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "benchmark"
  );
}

export async function saveJsonResult(
  value: unknown,
  options: SaveJsonResultOptions
): Promise<string> {
  await mkdir(options.outputDir, { recursive: true });
  const timestamp = (options.timestamp ?? new Date())
    .toISOString()
    .replace(/[:.]/g, "-");
  const filename = `${safeSegment(options.prefix ?? "benchmark")}-${timestamp}.json`;
  const path = join(options.outputDir, filename);
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
  return path;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 100) return value.toFixed(1);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatComparisonTable(rows: ComparisonTableRow[]): string {
  if (rows.length === 0) return "No benchmark comparisons.";

  const headers = [
    "Scenario",
    "Count",
    "Metric",
    "Baseline",
    "Candidate",
    "Change",
    "95% CI",
    "Verdict",
  ];
  const body = rows.map((row) => [
    row.scenario ?? "—",
    row.count === undefined ? "—" : String(row.count),
    row.metric,
    formatNumber(row.baseline),
    formatNumber(row.candidate),
    formatPercent(row.change),
    row.confidenceInterval
      ? `${formatPercent(row.confidenceInterval[0])}…${formatPercent(row.confidenceInterval[1])}`
      : "—",
    row.verdict,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((row) => row[index].length))
  );
  const render = (row: string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index])).join("  ");

  return [
    render(headers),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...body.map(render),
  ].join("\n");
}

export function printComparisonTable(rows: ComparisonTableRow[]): void {
  console.log(formatComparisonTable(rows));
}
