# Agent guide

Read [SPEC.md](SPEC.md) first, then this file.

## The one rule: the simulation is pure

Everything under `src/game/sim/` is deterministic TypeScript.

- No imports from `three`, React, the DOM, `render/`, `input/`, `audio/`, `app/` or `store/`.
- No `Math.random`, `Date`, `performance` — use the seeded `Rng` and the fixed step `dt`.
- No per-frame allocation: entities live in struct-of-arrays pools.
- ESLint enforces the import and global bans; the determinism replay test enforces the rest.

The renderer, audio and UI only _read_ simulation state and consume its event buffer.

## Where things live

| Path               | Contents                                                       |
| ------------------ | -------------------------------------------------------------- |
| `src/game/sim/`    | World, components, systems, RNG, pathing, waves, economy       |
| `src/game/render/` | three.js scene, camera, instanced meshes, particles, popups    |
| `src/game/input/`  | Joystick / keyboard / mouse / gamepad → `Intent`               |
| `src/game/audio/`  | Procedural Web Audio SFX and music                             |
| `src/app/`         | React screens (menus and HUD only — never in the game loop)    |
| `src/store/`       | Zustand stores, save data, migrations                          |
| `src/content/`     | Levels, maps, units, upgrades as JSON + Zod schemas            |
| `tests/unit/`      | Vitest: simulation systems, economy, waves, content validation |
| `tests/e2e/`       | Playwright smoke tests                                         |

## Levels are data

A new level is one JSON file in `src/content/levels/` plus (if needed) one map JSON in
`src/content/maps/`. Unit stats come from `src/content/units.json`, never from level files. Do not
add level-specific branches to the code.

## How to test

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm size && pnpm e2e
```

## Working rules

- When the spec is silent, choose the simplest option that keeps `sim/` pure and deterministic and
  log it in [DECISIONS.md](DECISIONS.md).
- No network calls, analytics, ads or third-party assets without a licence entry in `ASSETS.md`.
- Conventional commits; one PR per build-plan phase.
