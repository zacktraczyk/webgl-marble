---
name: verify
description: Build, launch, and drive the Marbel app to verify a change end-to-end (Astro dev server + headless Chromium over CDP).
---

# Verifying Marbel changes

## Launch

```bash
bun run dev   # Astro; picks the next free port (4321+) — read the actual port from stdout
```

No test data ships with the app: races live in `localStorage`
(`marbel:race-library:v1`), so a fresh browser profile starts empty.
Create state through the real UI (`[data-create-race]` on `/`), not by
seeding storage.

## Drive (headless browser)

Playwright is not installed, but its Chromium cache usually is:

```bash
~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell \
  --remote-debugging-port=9333 --user-data-dir=$SCRATCH/profile --no-first-run
```

Drive it with a plain Bun script over CDP (no npm deps): `fetch
http://localhost:9333/json/version`, open a WebSocket, then
`Target.createTarget` → `Target.attachToTarget {flatten:true}` →
`Page.navigate` / `Runtime.evaluate` / `Page.captureScreenshot`.
Set `Emulation.setDeviceMetricsOverride` (e.g. 1440×2000 @2x) so
canvas thumbnails render crisply. A worked example from a past session:
`drive.ts` pattern — click `[data-create-race]`, wait for
`/race-builder`, click `#complete-race` (auto-fill legs), screenshot.

## Flows worth driving

- Library `/` → create race → `/race-builder?race=<id>`.
- Builder: `#complete-race` auto-fills legs; `#marbles-plus/-minus`
  changes team count (re-renders all leg previews); keyboard reorder =
  focus `[data-drag-leg]`, dispatch ArrowUp/ArrowDown keydown; watch
  `#leg-move-status` and `#leg-guidance` text.
- Leg previews are 2D canvases (`renderLevelThumbnail`); leg at index i
  renders with `participants.length - i` teams.

## Gotchas

- `bun test` has 2 pre-existing failures in `tests/spawn-point.test.js`
  (tests expect 5 render parts, prefab emits 4) — not a regression signal.
- Kill the server/browser afterwards: `pkill -f "astro dev"`,
  `pkill -f chrome-headless-shell`.
