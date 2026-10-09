# Crownstack

You are a tiny king carrying a tower of coins on your head. Walk over gold to stack it, spend it
at the forge and build plots to arm your archers, and hold the palisade against waves of red
raiders and pink giants.

Crownstack is an installable, offline-capable web game (PWA) for phones and laptops. No backend,
no login, no ads, no trackers. All art and audio are generated in code.

The full design lives in [SPEC.md](SPEC.md); choices the spec leaves open are logged in
[DECISIONS.md](DECISIONS.md).

## Develop

Requires the Node version in `.nvmrc` and pnpm.

```bash
pnpm install
pnpm dev
```

| Script           | What it does                                                               |
| ---------------- | -------------------------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                                            |
| `pnpm build`     | Production build + 5 MB precache budget check                              |
| `pnpm preview`   | Serve the production build on :4173                                        |
| `pnpm lint`      | ESLint + Prettier check                                                    |
| `pnpm typecheck` | `tsc --noEmit` (strict)                                                    |
| `pnpm test`      | Vitest unit tests (simulation, content schemas)                            |
| `pnpm size`      | Initial JS budget (350 KB gzip)                                            |
| `pnpm e2e`       | Playwright smoke tests (desktop + Pixel 7); builds first with `pnpm build` |
| `pnpm icons`     | Regenerate the PWA icons                                                   |

## Architecture

```
Input ──intents──▶ Simulation (pure, 60 Hz, seeded) ──snapshot──▶ Renderer (three.js)
Content JSON (Zod-validated) ──▶ Simulation ──events──▶ UI shell (React + Zustand)
```

`src/game/sim` is pure TypeScript: no DOM, no three.js, no `Math.random`, no clock. ESLint
enforces this. See [AGENTS.md](AGENTS.md).

## Licence

MIT. Crownstack is an original game; it uses no assets, names or characters from any other game.
Third-party assets are listed in [ASSETS.md](ASSETS.md).
