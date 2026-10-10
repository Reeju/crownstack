import { DT } from './components';
import { collisions } from './systems/collisions';
import { combat } from './systems/combat';
import { enemyAI } from './systems/enemyAI';
import { heroMove } from './systems/heroMove';
import { lootSystem } from './systems/loot';
import { outcomeSystem } from './systems/outcome';
import { padSystem } from './systems/pads';
import { squadFollow } from './systems/squadFollow';
import { rebuildSpatial, targeting } from './systems/targeting';
import { waveSystem } from './systems/waves';
import type { World } from './world';

/** Hit flashes fade here so every system that deals damage shares one timer. */
function cleanup(w: World): void {
  for (let e = 0; e < w.highWater; e++) {
    if (w.flash[e] > 0) w.flash[e] = Math.max(0, w.flash[e] - DT);
  }
}

/** Advances the simulation by one fixed step of DT seconds (system order per SPEC §6.3). */
export function step(w: World): void {
  w.events.count = 0;
  w.px.set(w.x.subarray(0, w.highWater));
  w.py.set(w.y.subarray(0, w.highWater));

  heroMove(w);
  squadFollow(w);
  rebuildSpatial(w);
  enemyAI(w);
  targeting(w);
  combat(w);
  lootSystem(w);
  padSystem(w);
  waveSystem(w);
  collisions(w);
  cleanup(w);
  outcomeSystem(w);

  w.tick++;
  w.time = w.tick * DT;
}
