import { DT } from './components';
import { collisions } from './systems/collisions';
import { heroMove } from './systems/heroMove';
import { lootSystem } from './systems/loot';
import { padSystem } from './systems/pads';
import { squadFollow } from './systems/squadFollow';
import type { World } from './world';

/** Advances the simulation by one fixed step of DT seconds. */
export function step(w: World): void {
  w.events.count = 0;
  w.px.set(w.x.subarray(0, w.highWater));
  w.py.set(w.y.subarray(0, w.highWater));

  heroMove(w);
  squadFollow(w);
  lootSystem(w);
  padSystem(w);
  collisions(w);

  w.tick++;
  w.time = w.tick * DT;
}
