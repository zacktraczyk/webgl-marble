import type {
  AuditRecord,
  StructuralAssertion,
  VduRunnerConfig,
} from "./types";

function assertion(
  name: string,
  expected: string,
  actual: string | number,
  passed: boolean,
  note?: string
): StructuralAssertion {
  return { name, expected, actual: String(actual), passed, note };
}

export function evaluateStructuralAssertions(
  config: VduRunnerConfig,
  audits: AuditRecord[]
): StructuralAssertion[] {
  if (!config.audit) return [];
  const basic = audits.find(
    (entry) => entry.variant === "basic" || entry.variant === "baseline"
  );
  const candidate = audits.find(
    (entry) => entry.variant === "instanced" || entry.variant === "candidate"
  );
  if (!basic || !candidate) {
    return [
      assertion(
        "audit variants",
        "both variants audited",
        `${audits.length} audit(s)`,
        false
      ),
    ];
  }

  // Cross-build pages run their production `auto` strategies. Exact path and
  // draw-count expectations may differ between commits, so only compare them.
  if (config.baselineUrl && config.candidateUrl) {
    return [
      assertion(
        "draw-call change",
        "candidate no worse than baseline",
        `${basic.counters.totalDrawCalls} -> ${candidate.counters.totalDrawCalls}`,
        candidate.counters.totalDrawCalls <= basic.counters.totalDrawCalls
      ),
    ];
  }

  const results: StructuralAssertion[] = [];
  const expectedEntityDraws =
    config.scenario === "random-balls" ? config.count + 4 : config.count;
  if (config.scenario !== "full-race") {
    results.push(
      assertion(
        "basic draw calls",
        String(expectedEntityDraws),
        basic.counters.totalDrawCalls,
        basic.counters.totalDrawCalls === expectedEntityDraws,
        config.scenario === "random-balls"
          ? "random-balls count is the marble count; four walls are added"
          : undefined
      )
    );
  }

  if (config.scenario === "contiguous") {
    results.push(
      assertion(
        "instanced draw calls",
        "1",
        candidate.counters.totalDrawCalls,
        candidate.counters.totalDrawCalls === 1
      )
    );
  } else if (config.scenario === "random-balls") {
    results.push(
      assertion(
        "instanced draw calls",
        "approximately 4 contiguous mesh runs",
        candidate.counters.totalDrawCalls,
        candidate.counters.totalDrawCalls >= 2 &&
          candidate.counters.totalDrawCalls <= 6
      )
    );
  } else if (config.scenario === "fragmented") {
    results.push(
      assertion(
        "fragmented draw calls",
        String(expectedEntityDraws),
        candidate.counters.totalDrawCalls,
        candidate.counters.totalDrawCalls === expectedEntityDraws
      )
    );
  } else {
    results.push(
      assertion(
        "instanced draw calls",
        "no more than basic",
        candidate.counters.totalDrawCalls,
        candidate.counters.totalDrawCalls <= basic.counters.totalDrawCalls
      )
    );
  }

  if (candidate.metadata.vdu.activeStrategy === "instanced") {
    results.push(
      assertion(
        "instanced draw API",
        "> 0 calls",
        candidate.counters.drawArraysInstanced,
        candidate.counters.drawArraysInstanced > 0
      ),
      assertion(
        "per-entity matrix uniforms",
        "0",
        candidate.counters.uniformMatrix3fv,
        candidate.counters.uniformMatrix3fv === 0
      ),
      assertion(
        "per-entity color uniforms",
        "0",
        candidate.counters.uniform4fv,
        candidate.counters.uniform4fv === 0
      )
    );
    if (config.scenario !== "full-race") {
      results.push(
        assertion(
          "submitted instances",
          String(expectedEntityDraws),
          candidate.counters.totalInstancesSubmitted,
          candidate.counters.totalInstancesSubmitted === expectedEntityDraws
        )
      );
    }
  }

  return results;
}
