# VDU browser benchmark

The VDU suite compares the basic and instanced WebGL renderer paths in the
same production build. It uses fresh pages, per-page warmup, balanced paired
ordering, raw frame samples, a wrapper-free timed pass, and a separate WebGL
structural audit.

```sh
bun benchmarks/vdu/runner.ts run --preset smoke
bun benchmarks/vdu/runner.ts run --scenario contiguous --count 2500
bun benchmarks/vdu/runner.ts run --suite scaling --counts 100,500,1000,2500,5000
bun benchmarks/vdu/runner.ts run --suite full
bun benchmarks/vdu/runner.ts run --preset confidence --gpu
bun benchmarks/vdu/runner.ts compare baseline.json candidate.json
```

When `--url` is omitted, the runner builds the Astro project and starts a
temporary production preview. Use `--url` for an existing server. To compare
two builds or commits, start both servers and pass both URLs:

```sh
bun benchmarks/vdu/runner.ts run \
  --baseline-url http://127.0.0.1:4321 \
  --candidate-url http://127.0.0.1:4322
```

Cross-build mode exercises each build's `auto` renderer. Same-build mode uses
the explicit `basic` and `instanced` strategies. The primary verdict is based
on paired renderer CPU p95. Structural and visual correctness failures prevent
a performance result from being accepted.

The standard preset runs 10 pairs with 300 warmup frames and at least 600
measured frames per page. `smoke` is intended for harness validation;
`confidence` runs 20 longer pairs when results are close.

The `scaling` suite runs the selected scenario at every value supplied through
`--counts`. The `full` suite covers every scenario and runs the representative
full-race case both frozen and with physics active. One preview server and one
browser process are reused across suite cases, while each measured run still
gets a fresh page.
