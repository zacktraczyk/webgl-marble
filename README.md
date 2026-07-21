# Marble - WebGL Marble Race Game

A modern WebGL-based marble race game built with TypeScript, Astro, and a custom
physics engine. Features real-time physics simulation, collision detection, and
interactive level building.

## Glossary

| Term           | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| **level**      | Serialized course geometry (`SerializedLevel` / `AuthoredLevel`) under `game/level/` |
| **leg**        | One race stage that wraps a level document                                           |
| **leg editor** | Interactive course editor (`editor/legEditor`) used by the leg builder               |
| **VDU**        | Visual Display Unit — the WebGL renderer under `src/engine/vdu`                      |

## Features

- **WebGL Rendering**: High-performance graphics using WebGL
- **Physics Engine**: Custom physics simulation with collision detection
- **Leg Builder**: Interactive tool for creating custom race courses
- **Multiple Collision Algorithms**: GJK, SAT, and general collision resolution
- **Real-time Simulation**: Smooth 60fps physics updates
- **TypeScript**: Full type safety and better developer experience

More coming soon!

## Quick Start

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Modern web browser with WebGL support

### Installation

```bash
# Install dependencies
bun install
# or
npm install
```

### Development

```bash
# Start development server
bun dev
# or
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) to view the project.

### Building for Production

```bash
# Build the project
bun build
# or
npm run build

# Preview the build
bun preview
# or
npm run preview
```

## 🛠️ Available Scripts

| Command          | Description                  |
| ---------------- | ---------------------------- |
| `bun dev`        | Start development server     |
| `bun build`      | Build for production         |
| `bun preview`    | Preview production build     |
| `bun lint`       | Run ESLint                   |
| `bun lint:fix`   | Fix ESLint issues            |
| `bun type-check` | Run TypeScript type checking |
| `bun format`     | Format code with Prettier    |
| `bun test`       | Run unit tests (Bun)         |
| `bun bench:vdu`  | Benchmark VDU render paths   |
| `bun clean`      | Clean build artifacts        |

## VDU performance benchmark

The browser benchmark compares the basic and instanced WebGL paths with paired,
interleaved runs against a production build. It separately checks visual output
and WebGL call counts so instrumentation does not affect timed samples.

```bash
# Short harness check
bun run bench:vdu:smoke

# Standard paired benchmark
bun run bench:vdu -- --scenario contiguous --count 2500

# All representative scenarios
bun run bench:vdu:full
```

See [`benchmarks/vdu/README.md`](benchmarks/vdu/README.md) for presets, GPU
timing, cross-build comparison, and result interpretation.

## Layout

Product code lives under `src/` with intended dependency direction:

`pages` → `scenes` → `game` / `editor` / `races` → `engine`

Shared level documents, geometry, motion, constants, grid helpers, and race simulation (`RaceController`) live in `game/`. Interactive editing (`legEditor`, undo history, tools) lives in `editor/`.

Engine prototypes and legacy race demos live in `debug/` with Astro routes under `/dev/*`, separate from product `scenes/`.
