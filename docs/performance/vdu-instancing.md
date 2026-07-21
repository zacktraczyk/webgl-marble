# VDU instancing benchmark

Recorded on 2026-07-21 at commit
`6b25f6e761fc9954777c9e357225d6d679351018` from a clean detached worktree.
The result verifies that the VDU's instanced renderer reduces browser-main-thread
render submission cost. It does not establish a GPU-time or end-to-end frame
cadence improvement on this machine.

## What was compared

Both variants came from the same production build. The baseline explicitly used
the retained `basic` renderer and the candidate explicitly used the `instanced`
renderer. This isolates the draw submission change and avoids comparing unrelated
changes between commits. It therefore supports the instancing portion of commit
`c3841ee`, not every change in that commit as a bundle.

The standard preset used 10 balanced pairs. Every measured page received 300
warmup frames followed by 10 seconds and at least 600 measured frames. Each run
used a fresh page; the scenario seed was 18420 and physics was disabled.

| Scenario                  | Structural change |           Render CPU p95 |                 GPU p95 |      Frame interval p95 |
| ------------------------- | ----------------- | -----------------------: | ----------------------: | ----------------------: |
| 80 random balls + 4 walls | 84 to 4 draws     | 0.40 to 0.30 ms (-25.0%) |           not collected |  9.20 to 9.20 ms (0.0%) |
| 2,500 contiguous objects  | 2,500 to 1 draw   | 1.90 to 1.30 ms (-36.8%) | 2.30 to 2.27 ms (-2.8%) | 8.85 to 9.20 ms (+4.0%) |

The percentages are medians of the 10 paired relative changes, while the time
values are medians of each variant's per-run p95 values. Lower is better.

The representative result's CPU improvement was consistent in 9 of 10 pairs
(one tie), with a 95% confidence interval of -25.0% to -25.0% and sign-flip
`p = 0.0039`. The stress result improved in all 10 pairs, with a 95% confidence
interval of -52.9% to -23.7% and `p = 0.0020`.

GPU p95 in the stress test split 5 wins and 5 losses. Its 95% confidence interval
was wide (-48.1% to +35.0%), so the observed -2.8% median is inconclusive. The GPU
timer itself was healthy: 24,027 valid queries, with none discarded or pending.
Frame interval results were also inconclusive because their confidence intervals
included no change. This is plausible when the workload is not GPU- or refresh-
limited even though CPU submission work becomes cheaper.

## Correctness checks

All structural assertions passed. The instanced path submitted the expected
instance counts, issued no per-entity matrix or color uniforms, and reduced the
expected draw counts. Pixel comparison found 0 differing pixels out of 640,000
for both scenarios.

## Environment

- Apple M1 Pro, 10 logical CPUs, 16 GiB RAM
- macOS/Darwin 25.5.0, arm64
- Bun 1.3.11
- Chrome 150.0.7871.129
- WebGL 1 through ANGLE Metal on Apple M1 Pro

## Reproduction

Build and serve the recorded commit, then run:

```sh
bun benchmarks/vdu/runner.ts run \
  --url http://127.0.0.1:44321 \
  --scenario random-balls \
  --count 80 \
  --preset standard \
  --label canonical-vdu-instancing-random-balls

bun benchmarks/vdu/runner.ts run \
  --url http://127.0.0.1:44321 \
  --scenario contiguous \
  --count 2500 \
  --preset standard \
  --gpu \
  --label canonical-vdu-instancing-contiguous-gpu
```

The compact machine-readable record is in
[`benchmarks/baselines/vdu-instancing-m1-pro.json`](../../benchmarks/baselines/vdu-instancing-m1-pro.json).
Raw reports contain per-frame samples and are intentionally gitignored. The two
source reports for this record are retained locally as:

- `benchmarks/results/vdu-random-balls-80-2026-07-21T03-23-52-469Z.json`
- `benchmarks/results/vdu-contiguous-2500-2026-07-21T03-29-16-037Z.json`
