import type { Mixer } from './mixer';

type Wave = OscillatorType;

/** Minimum seconds between two plays of the same effect, so a volley is not a wall of noise. */
const MIN_GAP = { coin: 0.04, arrow: 0.05, hit: 0.05, tick: 0.03, blip: 0.06 } as const;

/**
 * Procedural sound effects (SPEC §5.3): every sound is a few oscillators or a
 * burst of filtered noise, so the game ships no audio files.
 */
export class Sfx {
  private noise: AudioBuffer | null = null;
  private readonly last: Record<string, number> = {};

  constructor(private readonly mixer: Mixer) {}

  /** Sine chirp 880 -> 1320 Hz. */
  coin(): void {
    if (this.tooSoon('coin', MIN_GAP.coin)) return;
    this.tone('sine', 880, 1320, 0.09, 0.22);
  }

  /** Band-passed noise: an arrow leaving the string. */
  arrow(): void {
    if (this.tooSoon('arrow', MIN_GAP.arrow)) return;
    this.noiseBurst('bandpass', 2600, 2, 0.07, 0.16);
  }

  /** Low thud. */
  hit(): void {
    if (this.tooSoon('hit', MIN_GAP.hit)) return;
    this.tone('sine', 150, 60, 0.11, 0.3);
  }

  /** A giant's blow or a chieftain's slam. */
  heavy(): void {
    this.tone('sine', 95, 38, 0.3, 0.55);
    this.noiseBurst('lowpass', 420, 0.7, 0.22, 0.35);
  }

  /** One tick of the rising loop heard while coins flow into a pad. `progress` is 0..1. */
  padTick(progress: number): void {
    if (this.tooSoon('tick', MIN_GAP.tick)) return;
    const freq = 520 + 720 * progress;
    this.tone('triangle', freq, freq * 1.04, 0.045, 0.16);
  }

  padDone(): void {
    this.arpeggio('triangle', [659, 880, 1319], 0.07, 0.24);
  }

  /** Two-note saw horn announcing a wave. */
  horn(): void {
    this.tone('sawtooth', 196, 196, 0.34, 0.2, 0, 900);
    this.tone('sawtooth', 147, 147, 0.6, 0.22, 0.34, 900);
  }

  dash(): void {
    this.noiseBurst('highpass', 1200, 0.5, 0.16, 0.2);
  }

  gearForged(): void {
    this.arpeggio('square', [1175, 1568], 0.06, 0.12);
  }

  gearDelivered(): void {
    if (this.tooSoon('blip', MIN_GAP.blip)) return;
    this.tone('square', 988, 1319, 0.07, 0.1);
  }

  win(): void {
    this.arpeggio('triangle', [523, 659, 784, 1047, 1319], 0.11, 0.26);
  }

  lose(): void {
    this.arpeggio('sawtooth', [392, 330, 262, 196], 0.2, 0.16);
  }

  private tooSoon(key: string, gap: number): boolean {
    const now = this.mixer.context?.currentTime ?? 0;
    if (now - (this.last[key] ?? -1) < gap) return true;
    this.last[key] = now;
    return false;
  }

  private arpeggio(wave: Wave, freqs: number[], stepSec: number, gain: number): void {
    freqs.forEach((f, i) => this.tone(wave, f, f, stepSec * 1.8, gain, i * stepSec));
  }

  /** One enveloped oscillator sweeping from `from` to `to` Hz. */
  private tone(
    wave: Wave,
    from: number,
    to: number,
    sec: number,
    gain: number,
    delay = 0,
    lowpass = 0,
  ): void {
    const ctx = this.mixer.context;
    const bus = this.mixer.sfxBus;
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + sec);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + sec);
    if (lowpass > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter).connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(bus);
    osc.start(t0);
    osc.stop(t0 + sec + 0.02);
  }

  private noiseBurst(
    type: BiquadFilterType,
    freq: number,
    q: number,
    sec: number,
    gain: number,
  ): void {
    const ctx = this.mixer.context;
    const bus = this.mixer.sfxBus;
    if (!ctx || !bus) return;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + sec);
    source.connect(filter).connect(env).connect(bus);
    source.start(t0, Math.random() * 0.2, sec + 0.02);
  }
}
