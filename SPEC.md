# Crownstack — Game Spec (v1)

As of 2026-10-10. Owner: Soham. Working title "Crownstack" (rename freely).

> Hand this file to a coding agent (Codex, Claude Code). Read it top to bottom, then follow Section 9 phase by phase. When the spec is silent, choose the simplest option that keeps `sim/` pure and deterministic and log the decision in `DECISIONS.md`.

---

## 1. Overview

Build **Crownstack**: an original, installable web game that recreates the hero-defense minigame shown in a Kingshot playable ad and extends it into 12 levels with progression. It runs as a PWA in any modern browser on phones (touch joystick) and laptops (keyboard or mouse), with no backend, no login, and no ads.

**Pitch:** You are a tiny king carrying a tower of coins on your head. Walk over gold to stack it, spend it at the forge and build plots to arm your archers, and hold the palisade against waves of red raiders and pink giants.

**Audience:** casual players, 30-second to 5-minute sessions, one-handed on mobile.

**Deliverables**
- Production repo on GitHub, deployed to Vercel, CI running lint, type-check, unit tests and a Playwright smoke test on every push.
- The complete game: title, level select, 12 levels (levels 1–3 recreate the ad beat for beat), upgrades, win/lose flow, local save, settings, offline play.
- Original art and audio (no Kingshot assets, names, logos or characters); stylized low-poly isometric look in WebGL.

**Non-negotiables:** 60 fps on a mid-range Android phone (Pixel 6a class), ≤ 5 MB initial download, fully offline after first load, Lighthouse PWA installable, no third-party trackers.

**Non-goals (v1):** multiplayer, server saves, IAP, the 4X city-builder that the real Kingshot is.

---

## 2. Reference analysis

The 69-second recording (2424×1080, 60 fps, landscape) is a playable-ad-style minigame, not the real Kingshot. The real Kingshot (Century Games, Feb 2025) is an idle medieval survival / 4X city-builder with gacha heroes and alliance warfare; its ads are known for showing minigames that are not in the game. We build the minigame the ad shows — for real.

### 2.1 What the ad shows

| Time | On screen | Mechanic to replicate |
|---|---|---|
| 0–3 s | Isometric camp: palisade fence, dirt yard, grass, dirt path curving in from top-right. Blue-coated king at centre with a very tall coin stack on his head and a white ring (squad radius). Brown archers on corner platforms. Gold counter top-right (237). | Hero + coin stack, squad ring, archer towers, HUD gold |
| 2–8 s | Red raiders stream down the path. Pink giant with red HP bar reaches the fence. Floating "-20" numbers. Hero walks onto a green "50" pad beside the forge; coins fly off the stack along a dotted blue arrow into the pad. Virtual joystick bottom-right. | Enemy path + waves, giants with HP bars, damage popups, pay-by-standing pads, joystick |
| 8–24 s | Hero leaves camp up the path with archers following; archers auto-shoot. Coins drop from kills and auto-collect; HUD rises 238→350. Some archers die to giants. White diamond plates with a bow icon mark empty build plots. | Follow-the-leader squad, auto-aim, coin pickup, kill rewards, build plots |
| 24–50 s | Hero returns and pays the forge pad again (cost now 80). 2–3 giants plus 20–40 raiders at once. Gold peaks at 473 then falls to 310 as the hero spends. | Rising costs, escalating waves, spend decisions |
| 50–62 s | Forge turns paid gold into a stack of blue bows the hero carries like coins. He walks it to the squad; squad turns blue (armoured). Archery house upgrades to a bigger building. | Forge crafting, equipment stack, squad upgrade, building upgrade |
| 62–69 s | Wave cleared: yard full of loose coins, blue squad celebrates, next pad reads 100. Logo + CTA. | Wave-clear state, reward burst, level-complete screen |

### 2.2 Mechanics inventory

1. **Hero movement** by joystick, free 8-direction movement on a flat plane with fence/rock collision.
2. **Coin stack**: coins stack on the hero's head (visual cap ~60, logical cap per level). Gold also counts in the HUD.
3. **Pay pads**: stand on a pad to stream gold into it; when full it triggers (build tower, craft gear, upgrade building).
4. **Squad**: N archers follow the hero in a loose ring, auto-target nearest enemy in range, fire arrows.
5. **Towers**: archers on fence platforms are static turrets.
6. **Enemies**: raiders (melee, 20 HP) and giants (high HP, knockback), follow a spline path to the fence, then attack nearest fence/tower/unit.
7. **Fence**: palisade segments with HP; level fails if king dies or keep is destroyed.
8. **Forge**: gold → equipment; carried as a blue stack and delivered to the squad to upgrade it.
9. **Waves**: timed spawn groups; level ends when the last wave is dead.
10. **Feedback**: damage popups, HP bars, hit sparks, coin burst, screen shake on giant hits.

Not copied: the Kingshot name, logo, CTA, exact character designs, exact map. Art is original (Section 5).

---

## 3. Game design

### 3.1 Core loop
Collect gold (kills, loose coins, chests) → carry it as a stack → spend on pads (towers, forge gear, fence repair, keep upgrade) → survive the next wave stronger → repeat until the final wave is cleared. Tension: leaving the yard to collect coins while raiders press the fence.

### 3.2 Controls

| Platform | Move | Interact | Pause |
|---|---|---|---|
| Touch | Floating virtual joystick: appears where the thumb lands on the lower 70% of the screen; dead zone 12 px; max radius 60 px | Automatic (stand on pads, walk into coins) | HUD button top-left |
| Keyboard | WASD / arrows, diagonals normalised | Automatic; Space = dash (level 4+) | Esc or P |
| Mouse / trackpad | Click-and-hold: hero walks toward cursor | Automatic | HUD button |
| Gamepad (nice-to-have) | Left stick | A = dash | Start |

No aim button. Squad and towers auto-target. Player skill = **positioning and spending**.

### 3.3 Entities and base stats

| Entity | HP | Dmg | Rate | Range | Speed (u/s) | Notes |
|---|---|---|---|---|---|---|
| King | 200 | 0 | – | – | 5.0 | Carries stack; 1 s i-frames after hit; regen 5 HP/s after 4 s without damage |
| Archer tier 0 | 40 | 20 | 1/0.8 s | 7 | 5.5 | Follows in ring radius 1.5; arrow speed 18 |
| Archer tier 1 (blue) | 70 | 30 | 1/0.7 s | 8 | 5.5 | Via forge gear |
| Archer tier 2 (gold) | 110 | 45 | 1/0.6 s | 9 | 5.5 | Level 7+ |
| Tower archer (t1/t2/t3) | 60/100/160 | 20/30/45 | 1/0.8 s | 9 | 0 | Static on fence platform |
| Raider (red) | 20 | 10 | 1/1.0 s | melee 0.8 | 3.0 | Drops 1 coin (10 gold) |
| Raider brute (L5+) | 60 | 20 | 1/1.2 s | melee | 2.6 | Drops 3 coins |
| Giant (pink) | 600 | 60 | 1/2.0 s | melee 1.5 | 1.8 | Knockback 2 u; drops 10 coins; stagger after 30 hits |
| Chieftain (boss L6/9/12) | 2000/3500/6000 | 100 | 1/2.5 s | melee 2.0 | 1.6 | Ground slam AoE every 8 s (r 3); drops 30 coins |
| Fence segment | 150 | – | – | – | – | Repairable at pad; rebuilt at level start |
| Keep | 1000 | – | – | – | – | Level lost at 0 |

1 world unit = 1 m; the yard is 24×18 units.

### 3.4 Economy
- Coin = 10 gold. Ground coins despawn after 20 s (blink last 5 s).
- Stack carry cap: 60 coins at level 1, +10 per keep tier (max 120). Gold above the cap goes to the HUD bank (no cap). **Only stacked coins can be spent at pads**, except the keep-upgrade pad which draws from the bank.
- Pad draw rate: 100 gold/s while standing on it; progress ring + remaining cost shown.
- Base costs (level 1): tower 50, forge gear batch 80, fence repair 30, keep upgrade 200. Repeat purchases of the same kind on the same level cost +30% (rounded to 10).
- Forge: produces a **gear stack** of 6 blue bows carried on top of coins. Walking into squad members hands out one bow each (+1 tier). Undelivered gear is lost after 30 s.
- Level reward: 100 gold × level number, plus 1–3 crowns by keep HP remaining (>80% = 3, >40% = 2, else 1). Crowns buy meta upgrades (4.4).

### 3.5 Win / lose
- **Win:** every wave spawned and every enemy dead → 1.5 s celebration → results panel.
- **Lose:** king HP 0 or keep HP 0 → "The camp has fallen" → Retry (same seed) / Level select. No ads, no energy.
- Waves announced 3 s ahead with an edge arrow pointing at the spawn path.

### 3.6 Scoring and difficulty
- Score = gold earned + 50/kill + 500/giant + time bonus (max 1000, linear decay over par time).
- Difficulty: Easy (enemy HP ×0.7), Normal, Hard (enemy HP ×1.4, coin cap −20). Best scores stored per level per difficulty.
- Determinism: seeded PRNG (level id + attempt); Retry reproduces the waves; seed shown on results for bug reports.

---

## 4. Level design

Twelve levels in three acts. Levels 1–3 are the ad as a tutorial arc. Each level is a JSON file under `src/content/levels/` validated by Zod. No hard-coded level logic.

### 4.1 Level table

| # | Name | Map | Paths | Waves | Enemies | Giants | New mechanic | Par | Start gold |
|---|---|---|---|---|---|---|---|---|---|
| 1 | First Watch | Yard A (ad map) | 1 (NE) | 3 | 24 raiders | 0 | Move, collect, pay tower pad (50) | 1:30 | 60 |
| 2 | The Forge | Yard A | 1 | 4 | 40 raiders | 1 | Forge pad (80), gear stack, blue squad | 2:00 | 80 |
| 3 | Hold the Line | Yard A | 2 (NE, E) | 5 | 60 raiders | 2 | Fence repair, second path, keep upgrade (200) | 2:30 | 100 |
| 4 | Ridge Road | Ridge B (cliffs, narrow pass) | 1 (N) | 5 | 70 raiders | 2 | Dash (Space / double-tap), chests on path | 2:30 | 100 |
| 5 | Brutes | Ridge B | 2 (N, W) | 6 | 70 raiders, 10 brutes | 2 | Brute enemy, tower tier 2 | 3:00 | 120 |
| 6 | The Chieftain | Ridge B | 2 | 6 + boss | 80 raiders, 12 brutes | 2 + boss | Boss ground slam; wave arrow | 3:30 | 150 |
| 7 | Riverside | River C (bridge chokepoint, two yards) | 2 (S, E) | 7 | 100 raiders, 16 brutes | 3 | Gold-tier archers, bridge gate pad | 3:30 | 150 |
| 8 | Night Raid | River C (night, torches) | 3 | 7 | 120 raiders, 20 brutes | 4 | Tower range ×0.8 at night unless brazier pad lit (40) | 4:00 | 180 |
| 9 | Twin Chieftains | River C | 3 | 8 + 2 bosses | 120 raiders, 24 brutes | 4 + 2 bosses | Two bosses on opposite paths | 4:30 | 200 |
| 10 | Siege Camp | Fortress D (large, 4 plots per side) | 4 | 9 | 160 raiders, 30 brutes | 6 | Four paths, tower tier 3, gate closes while paid | 5:00 | 250 |
| 11 | Endless Dusk | Fortress D (night) | 4 | 10 | 200 raiders, 40 brutes | 8 | Giants in pairs; coin despawn 12 s | 5:30 | 250 |
| 12 | King of the Hill | Fortress D | 4 | 10 + final boss | 220 raiders, 48 brutes | 8 + boss (6000 HP) | Final boss summons raiders every 10 s | 6:00 | 300 |

### 4.2 Map layouts
Each map is a 1-unit grid stored as layers: `ground` (grass, dirt, cliff, water), `blockers` (fence segments with HP, rocks, trees, buildings), `plots` (tower plots: position, allowed tiers), `pads` (type, position, base cost), `paths` (spline control points per path, ending at a fence segment), `spawns` (path id per spawn), `hero_start`, `keep` (position, size). Yard A must match the ad: keep top-left, forge + pad bottom-centre of yard, four corner tower plots, path entering top-right and curving down the right side of the fence.

### 4.3 Level schema (example)

```json
{
  "id": 2,
  "name": "The Forge",
  "map": "yard-a",
  "startGold": 80,
  "parTimeSec": 120,
  "coinCap": 60,
  "squad": { "archers": 4, "tier": 0 },
  "pads": [
    { "type": "tower", "plot": "ne", "cost": 50 },
    { "type": "forge", "cost": 80, "produces": { "gear": 6 } }
  ],
  "waves": [
    { "at": 3,  "path": "ne", "groups": [{ "type": "raider", "count": 8,  "interval": 0.6 }] },
    { "at": 25, "path": "ne", "groups": [{ "type": "raider", "count": 12, "interval": 0.5 }] },
    { "at": 50, "path": "ne", "groups": [{ "type": "giant", "count": 1, "interval": 0 }, { "type": "raider", "count": 10, "interval": 0.5, "delay": 2 }] },
    { "at": 80, "path": "ne", "groups": [{ "type": "raider", "count": 10, "interval": 0.4 }] }
  ],
  "tutorial": [
    { "trigger": "start", "text": "Drag to move. Walk over coins to stack them." },
    { "trigger": "gold>=80", "text": "Stand on the forge pad to craft bows.", "pointAt": "pad:forge" },
    { "trigger": "gearCarried", "text": "Walk into your archers to hand out the bows." }
  ]
}
```

`at` = seconds since level start; `"at": "prevCleared+5"` allowed for reactive pacing. Enemy stats come from `src/content/units.json`, never from level files.

### 4.4 Meta progression
Crowns (max 36) buy a small tree on the level-select screen: Coin cap +10 (3 ranks, 2 crowns each), King HP +50 (3 ranks, 2), Starting archers +1 (3 ranks, 3), Tower cost −10% (2 ranks, 3), Coin magnet radius +0.5 (2 ranks, 2). Level N+1 unlocks when level N is cleared on any difficulty.

---

## 5. Art, audio and UX

### 5.1 Visual
- Flat-shaded low-poly 3D, isometric camera (orthographic, pitch 50°, yaw 45°). Palette: grass `#8CC63F`, dirt `#D9B382`, cliff `#5E6B5A`, wood `#8B5A2B`, gold `#F7C948`, hero blue `#2F6DE1`, enemy red `#E53935`, giant pink `#F4B6C2`, gear blue `#4FC3F7`.
- **All meshes generated in code from primitives** (box, cylinder, cone, sphere). Characters = 6–8 primitives. No binary 3D assets.
- Coin stack: instanced cylinders with per-coin spring lag (stiffness 120, damping 14) for the wobbly-tower feel.
- Feedback: floating damage text (canvas atlas billboards), hit sparks (8-quad burst), red hit flash, coin burst on kill, 120 ms shake on giant hits, pad progress ring, dotted gold line hero→pad while paying.
- Day/night theme objects; night adds emissive torches + dark-blue fog.
- One draw call per instanced type: raiders, archers, coins, arrows, trees, fence posts via `InstancedMesh`.

### 5.2 UI
- Screens: Title, Level Select (12 nodes with crowns), HUD, Pause, Results, Fallen, Settings, Upgrades, About.
- HUD: pause + level name top-left; gold with crown icon top-right (tweened); wave counter + 3 s "Wave N incoming" banner with direction arrow top-centre; keep HP bar bottom-left when damaged; floating joystick on touch.
- Font: one self-hosted open-licence rounded display font (Fredoka / Baloo 2) for headings; system font for body. Tap targets ≥ 48 px.
- Safe areas via `env(safe-area-inset-*)`. Both orientations; portrait zooms out 15% and moves gold to top-centre. Never a "rotate device" blocker.
- Accessibility: reduced-motion (no shake/bob), colour-blind shape markers (raider triangle decal, giant square), 4.5:1 text contrast, keyboard navigation on all menus.

### 5.3 Audio
- Procedural Web Audio SFX (coin = sine chirp 880→1320 Hz, arrow = band-passed noise, hit = low thud, pad = rising tick loop, wave horn = two-note saw). No audio files by default.
- Music: 32-bar looped chiptune from a small sequencer (or CC0 OGG < 300 KB). Separate music/SFX sliders; muted until first gesture.
- Haptics: `navigator.vibrate(15)` on pad completion and giant hit, if supported/enabled.

---

## 6. Technical architecture

The simulation is a pure, deterministic TypeScript module with no DOM or three.js imports; React UI and the three.js renderer only read from it.

```
Input (joystick/keys/mouse) ──intents──▶ Simulation (ECS, 60 Hz, seeded RNG) ──snapshot──▶ Renderer (three.js)
Content (levels/*.json, units.json, Zod) ──data──▶ Simulation
Simulation ──events──▶ UI shell (React + Zustand) ──commands──▶ Simulation
UI shell ◀──read/write──▶ Save (IndexedDB via idb-keyval)
Service worker (Workbox) precaches shell, code and content → fully offline after first load
```

### 6.1 Stack

| Concern | Choice |
|---|---|
| Build | Vite + TypeScript (strict), pnpm |
| UI | React 18 + Zustand (menus/HUD only; no React in the game loop) |
| Rendering | three.js (WebGL2, WebGL1 fallback), instancing, orthographic camera |
| Simulation | Hand-rolled ECS (typed arrays, system functions) or `bitecs`; fixed 1/60 s step with accumulator; render interpolation |
| Content validation | Zod schemas (levels, maps, units, upgrades); build fails on bad JSON |
| Persistence | `idb-keyval` with localStorage fallback |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`) |
| Tests | Vitest (sim, schemas), Playwright (smoke, desktop + Pixel 7 emulation) |
| Quality | ESLint (typescript-eslint), Prettier, Husky, `size-limit` |

### 6.2 Folder layout

```
crownstack/
  public/                 icons (192, 512, maskable)
  src/
    main.tsx              boot: register SW, mount React, create Game
    app/                  React screens: Title, LevelSelect, Hud, Pause, Results, Settings, Upgrades
    store/                Zustand slices: progress, settings, session; migrations.ts
    game/
      Game.ts             owns loop, input, sim, renderer; start(levelId, seed), pause(), dispose()
      loop.ts             rAF + fixed-step accumulator (dt = 1/60, max 5 steps/frame)
      sim/                PURE: world.ts, components.ts, systems/*.ts, rng.ts, pathing.ts, waves.ts, economy.ts
      render/             three.js: scene.ts, camera.ts, meshes/*.ts, instancing.ts, particles.ts, popups.ts
      input/              joystick.ts, keyboard.ts, mouse.ts, gamepad.ts → Intent { move: vec2, dash: bool }
      audio/              synth.ts, music.ts, mixer.ts
    content/
      levels/01-first-watch.json … 12-king-of-the-hill.json
      maps/yard-a.json, ridge-b.json, river-c.json, fortress-d.json
      units.json, upgrades.json, schema.ts
    pwa/                  sw registration, update prompt
  tests/unit/             sim systems, economy, wave scheduler, schema validation of every content file
  tests/e2e/              playwright: boots, installs, plays level 1 to win with scripted input
  .github/workflows/ci.yml
  vercel.json
  README.md  AGENTS.md  SPEC.md  DECISIONS.md
```

### 6.3 Simulation details
- **Loop:** rAF → `accumulate(dt)`; sim steps at fixed 1/60 s; renderer interpolates positions between the last two states. Tab hidden = pause.
- **Components:** Transform, Velocity, Health, Team, Attack (damage, rate, range, cooldown), Target, PathFollower (pathId, t), Squad (leaderId, slot), Stack (coins, gear), Pad (type, cost, paid), Lifetime, Loot. Struct-of-arrays (Float32Array/Int32Array) with an entity free-list.
- **System order per step:** input → heroMove → squadFollow → pathFollow → targeting (spatial hash, cell 2 u) → attack/projectiles → damage/death → loot/pickup → pads/economy → waves → collisions (circle–circle, circle–AABB fence) → cleanup → win/lose.
- **Determinism:** one `mulberry32` RNG per run; no `Math.random` / `Date.now` in `sim/`. A unit test replays a recorded intent log and asserts the final state hash.
- **Events:** ring buffer per step (`EnemyKilled`, `CoinPicked`, `PadPaid`, `WaveStarted`, `LevelWon`, `LevelLost`); renderer consumes for VFX/SFX, store for HUD/results.
- **Pathing:** Catmull-Rom splines from map data; separation steering (r 0.5); when the target fence segment dies, re-target nearest tower, then keep.

### 6.4 Save data

```ts
type SaveV1 = {
  version: 1;
  levels: Record<number, { crowns: 0|1|2|3; bestScore: Record<'easy'|'normal'|'hard', number>; cleared: boolean }>;
  crownsSpent: number;
  upgrades: Record<string, number>;      // upgradeId -> rank
  settings: { music: number; sfx: number; haptics: boolean; reducedMotion: boolean; colorBlind: boolean; difficulty: 'easy'|'normal'|'hard' };
  stats: { kills: number; goldEarned: number; playtimeSec: number };
};
```

Migrations in `store/migrations.ts`; unknown versions reset to defaults after backing up the raw blob to `localStorage['crownstack.backup']`.

---

## 7. PWA, responsiveness, performance

### 7.1 PWA
- Manifest: `name`/`short_name` Crownstack, `display: standalone`, `orientation: any`, `theme_color #2F6DE1`, `background_color #1B1F2A`, icons 192/512 + maskable 512, `start_url /?source=pwa`, `id /`.
- `vite-plugin-pwa` `generateSW`: precache app shell, JS/CSS, fonts, all `content/*.json`; no runtime caching needed. `registerType: 'prompt'` with an in-app "Update available" toast; never auto-reload mid-level.
- Install: capture `beforeinstallprompt`; "Install" button on title and after first win; iOS shows a "Share → Add to Home Screen" hint.
- Offline: Playwright test loads, goes offline, reloads, plays level 1.
- Lighthouse (mobile, on the Vercel preview): installable, Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.

### 7.2 Responsive
- Canvas fills viewport (`100dvh`, `touch-action: none`, `overscroll-behavior: none`); DPR capped at 2; UI is DOM.
- Camera: level `cameraBounds` always visible in both orientations; zoom from the shorter side; portrait zooms out 15%, single-row HUD.
- DOM breakpoints: ≤ 480 phone, ≤ 1024 tablet, > 1024 laptop (menus max-width 960, centred). Keyboard hints only after a key event.
- Pointer events only; `pointercancel` releases the joystick; first pointer owns the joystick, later pointers may hit HUD buttons.
- iOS: `user-select: none`, `-webkit-touch-callout: none`, `viewport-fit=cover`, double-tap zoom disabled.

### 7.3 Performance budgets

| Budget | Target | Enforcement |
|---|---|---|
| Initial JS (gz) | ≤ 350 KB | `size-limit` in CI |
| Total precache | ≤ 5 MB | CI reads the Workbox manifest |
| Frame time | ≤ 16.6 ms on Pixel 6a with 300 entities | `?debug=1` overlay (sim ms / render ms / draw calls); Playwright asserts ≥ 55 fps avg in level 10 on desktop CI |
| Draw calls | ≤ 40 / frame | Instancing, one material per type |
| Allocation | none per frame in `sim/` | Object pools for projectiles, coins, popups |
| TTI | ≤ 2.5 s on 4G | Lighthouse CI |

- Quality tiers auto-detected by a 1 s benchmark (low: no shadows, 150 particles, dpr 1; high: 1024 shadow map, 600 particles, dpr 2); user override in settings.
- Pause on `visibilitychange`; resume with a 3-2-1 countdown.

---

## 8. Repo, CI/CD, GitHub, Vercel

### 8.1 GitHub
- Repo `crownstack`, default branch `main`, MIT, `.nvmrc` at current Node LTS, `pnpm-lock.yaml` committed.
- Branch protection: PR required, CI green, squash merge. Feature branches `feat/<area>`; PRs include description + screenshot/GIF + preview link.
- Conventional commits; `CHANGELOG.md`.
- Required files: `README.md`, `AGENTS.md` (pure-sim rule, where content lives, how to test), `SPEC.md` (this), `CONTRIBUTING.md`, `DECISIONS.md`, issue templates.

### 8.2 CI (`.github/workflows/ci.yml`)
On push/PR: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm size` → `pnpm e2e` (chromium, 1280×800 + Pixel 7 emulation) → upload Playwright report + `dist/`. Nightly: Lighthouse CI against production; open an issue on budget regression.

### 8.3 Vercel
- Import the repo (preset Vite, build `pnpm build`, output `dist`). PR previews; `main` → production. No functions, no secrets.
- `vercel.json`:

```json
{
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Content-Type", "value": "application/manifest+json" }] },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ] }
  ],
  "rewrites": [{ "source": "/((?!assets|sw.js|workbox-.*|manifest.webmanifest|icons).*)", "destination": "/index.html" }]
}
```

- Hashed assets immutable; `sw.js` and `index.html` never long-cached.
- Analytics: none unless the owner opts into Vercel Web Analytics.
- "Deployed" means: production URL loads, installs on Android Chrome and iOS Safari, plays level 1 offline after first load, Lighthouse budgets met.

---

## 9. Build plan (phases, each ends in a PR + green CI + Vercel preview)

### Phase 0 — Scaffold and deploy
1. Vite + React + TS, ESLint, Prettier, Vitest, Playwright, Husky, pnpm, `vite-plugin-pwa`, `size-limit`.
2. `vercel.json`, CI workflow, README, AGENTS.md, SPEC.md.
3. Title screen with "Play" and an empty WebGL canvas.
**Accept:** CI green; production URL serves the title; Lighthouse installable; `pnpm e2e` boot test passes.

### Phase 1 — Vertical slice: hero, coins, pads (ad 0–8 s)
1. Fixed-step loop, ECS world, RNG, Yard A loader with Zod.
2. Hero moves (joystick/keyboard/mouse) with fence collision; coin stack with sway; ground coins, pickup, HUD gold.
3. Pay pad with progress ring and dotted coin line; tower appears on plot with an archer.
**Accept:** unit tests for movement, pickup, pad economy, determinism replay; 60 fps on a phone from the preview URL.

### Phase 2 — Combat and waves (ad 8–50 s)
1. Raiders on splines with separation; giants with knockback; spatial-hash targeting; pooled arrows; damage, death, loot.
2. Squad follow + auto-fire; tower archers; fence HP; keep HP; win/lose; results and fallen screens.
3. Wave scheduler from JSON; wave banner + arrow; popups, sparks, shake.
**Accept:** level 1 plays to win; scripted Playwright wins level 1; sim step ≤ 3 ms with 300 entities (Vitest bench).

### Phase 3 — Forge, upgrades, the full ad (ad 50–69 s)
1. Forge gear stack, delivery, tier visuals (blue, gold); keep upgrade pad + building growth; fence repair; rising costs.
2. Levels 2 and 3 authored and tuned to par.
3. Win celebration + coin burst.
**Accept:** levels 1–3 reproduce every beat in 2.1; 60 s capture of level 2 attached to the PR.

### Phase 4 — Content: levels 4–12 and meta
1. Maps B, C, D; dash; brutes; chieftains with slam; night palette + brazier; bridge gate; multi-path spawns; final boss summons.
2. Level select with crowns, sequential unlock, upgrades screen, difficulty, best scores, migrations.
3. Tuning: each level winnable on Normal within par + 50%; a heuristic bot (nearest coin, cheapest pad) must lose levels 6+ on Hard.
**Accept:** all 12 level files validate; bot results table in the PR; no level exceeds entity/draw-call budgets.

### Phase 5 — PWA polish, accessibility, release
1. Install flows, update toast, offline test, quality tiers, reduced motion, colour-blind markers, keyboard nav, safe areas, portrait layout.
2. Procedural SFX, music loop, mixer, mute-until-gesture, haptics.
3. Lighthouse CI nightly, size budgets, README with GIFs, `v1.0.0` tag + GitHub release.
**Accept:** every Section 7 item verified on a real Android phone and an iPhone via production; budgets met; release tagged.

### Working rules for the agent
- Read `SPEC.md` and `AGENTS.md` first. If the spec is silent, pick the simplest option that keeps `sim/` pure and deterministic; log it in `DECISIONS.md`.
- Every PR: what changed, how tested, screenshot/GIF, preview link.
- No network calls, analytics, ads or third-party assets without a licence file.
- Prefer generated geometry and procedural audio; any added asset must be CC0 and listed in `ASSETS.md`.
- Levels are data: a new level = one level JSON + one map JSON, nothing else.

---

## 10. Out of scope, open questions, future

**Out of scope (v1):** accounts, cloud saves, leaderboards, multiplayer, push; any monetisation; the Kingshot 4X layer; native wrappers.

**Open questions (defaults in brackets):**
- [ ] Game name and domain? [Crownstack at `crownstack.vercel.app`]
- [ ] Public or private repo? [public, MIT]
- [ ] Orthographic or perspective camera? [orthographic, 50° pitch]
- [ ] Should the king attack in v1? [no — squad and towers do all damage, like the ad]
- [ ] Vercel Web Analytics? [no analytics]

**Future (v1.1+):** endless mode with seeded daily run + Web Share result card; hero abilities (rally horn, gold magnet, arrow volley) bought with crowns; `/editor` route exporting the same JSON; cloud sync via Vercel KV/Supabase keyed by anonymous id; i18n (strings in `src/i18n/en.json`; Hindi and Bengali next).

---

## Appendix — Kickoff prompt for Codex / Claude Code

```
You are building Crownstack, a PWA game. The complete spec is in SPEC.md — read it fully before writing code.
Start with Phase 0 of Section 9: scaffold the repo exactly as Section 6.2 and 8 describe, get CI green,
and deploy to Vercel. Open a PR for each phase. Keep src/game/sim pure and deterministic.
Ask me only the five open questions in Section 10; otherwise use the defaults and record choices in DECISIONS.md.
After each phase, report: what shipped, test results, Vercel preview URL, and what you need from me.
```

Sources: the uploaded recording (69 s, 2424×1080, 60 fps); Kingshot App Store listing (https://apps.apple.com/app/id6739554056); Pocket Gamer hands-on (https://www.pocketgamer.com/kingshot/hands-on/); SocialPeta creative report (https://socialpeta.com/blog/With-2000-AI-Creatives-Daily-Century-Games-Kingshot-Dominates-Mobile-Charts-in-the-US-Japan-and-Korea-in-June); Two and a Half Gamers on Kingshot's genre mix (https://felixbraberg.substack.com/p/kingshots-insane-genre-mix-explained-5c2).
