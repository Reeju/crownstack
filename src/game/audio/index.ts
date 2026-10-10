import { Kind } from '../sim/components';
import { Ev, type EvType } from '../sim/events';
import type { World } from '../sim/world';
import { Mixer } from './mixer';
import { Music } from './music';
import { Sfx } from './synth';

const HAPTIC_MS = 15;

/** Turns simulation events into sound effects and haptics, and runs the music loop. */
export class AudioManager {
  private readonly mixer = new Mixer();
  private readonly sfx = new Sfx(this.mixer);
  private readonly music = new Music(this.mixer);
  private haptics = true;

  constructor() {
    this.mixer.onUnlock(() => this.music.start());
  }

  applySettings(settings: { music: number; sfx: number; haptics: boolean }): void {
    this.mixer.setVolumes(settings.music, settings.sfx);
    this.haptics = settings.haptics;
  }

  setSuspended(suspended: boolean): void {
    this.mixer.setSuspended(suspended);
  }

  onEvent(world: World, type: EvType, a: number, b: number): void {
    switch (type) {
      case Ev.CoinPicked:
        this.sfx.coin();
        break;
      case Ev.ArrowFired:
        this.sfx.arrow();
        break;
      case Ev.Damage:
        if (b !== Kind.Enemy) this.sfx.hit();
        break;
      case Ev.HeavyHit:
      case Ev.Slam:
        this.sfx.heavy();
        this.vibrate();
        break;
      case Ev.PadCoin: {
        const pad = world.pads[a];
        this.sfx.padTick(pad ? pad.paid / pad.cost : 0);
        break;
      }
      case Ev.PadPaid:
        this.sfx.padDone();
        this.vibrate();
        break;
      case Ev.WaveAnnounced:
        this.sfx.horn();
        break;
      case Ev.WavesCleared:
        this.sfx.win();
        break;
      case Ev.LevelLost:
        this.sfx.lose();
        break;
      case Ev.Dash:
        this.sfx.dash();
        break;
      case Ev.GearForged:
        this.sfx.gearForged();
        break;
      case Ev.GearDelivered:
        this.sfx.gearDelivered();
        break;
      case Ev.EnemyKilled:
        if (b > 0) this.sfx.heavy();
        break;
      default:
        break;
    }
  }

  dispose(): void {
    this.music.stop();
    this.mixer.dispose();
  }

  private vibrate(): void {
    if (this.haptics) navigator.vibrate?.(HAPTIC_MS);
  }
}
