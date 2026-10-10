import type { Mixer } from './mixer';

const BPM = 112;
const STEPS_PER_BAR = 16;
const STEP_SEC = 60 / BPM / 4;
const BARS = 32;
const LOOKAHEAD_SEC = 0.25;
const SCHEDULER_MS = 80;

/** Semitone offsets from A2 for each chord root, and whether the chord is minor. */
const CHORDS: Record<string, { root: number; minor: boolean }> = {
  Am: { root: 0, minor: true },
  F: { root: 8, minor: false },
  C: { root: 3, minor: false },
  G: { root: 10, minor: false },
  Dm: { root: 5, minor: true },
  E: { root: 7, minor: false },
};

/** 32 bars: an 8-bar theme, its answer, a bridge, and the theme again. */
const PROGRESSION = [
  ...['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'],
  ...['Am', 'Am', 'F', 'F', 'C', 'G', 'Am', 'E'],
  ...['Dm', 'Dm', 'Am', 'Am', 'F', 'F', 'E', 'E'],
  ...['Am', 'Am', 'F', 'F', 'C', 'G', 'Am', 'Am'],
];

/** Lead motifs: chord-tone indices per 8th note, -1 = rest. Bars pick one in rotation. */
const MOTIFS = [
  [0, -1, 2, 1, 2, -1, 3, 2],
  [3, 2, 1, -1, 0, 1, 2, -1],
  [0, 1, 2, 3, 4, 3, 2, 1],
  [2, -1, 2, 3, -1, 1, 0, -1],
];

const freq = (semitonesFromA2: number): number => 110 * 2 ** (semitonesFromA2 / 12);

/** Chord tones stacked upward from the root: 0 = root, 1 = third, 2 = fifth, 3 = octave... */
function chordTone(chord: { root: number; minor: boolean }, index: number): number {
  const steps = [0, chord.minor ? 3 : 4, 7];
  return chord.root + steps[index % 3] + 12 * Math.floor(index / 3);
}

/**
 * A 32-bar chiptune loop from a tiny step sequencer (SPEC §5.3): triangle
 * bass, a quiet square arpeggio and a square lead, scheduled a quarter of a
 * second ahead on the audio clock.
 */
export class Music {
  private timer = 0;
  private step = 0;
  private nextTime = 0;

  constructor(private readonly mixer: Mixer) {}

  start(): void {
    const ctx = this.mixer.context;
    if (!ctx || this.timer !== 0) return;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(this.schedule, SCHEDULER_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  private readonly schedule = (): void => {
    const ctx = this.mixer.context;
    if (!ctx || ctx.state !== 'running') return;
    // After a long suspension, jump ahead instead of replaying the backlog.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % (BARS * STEPS_PER_BAR);
      this.nextTime += STEP_SEC;
    }
  };

  private playStep(step: number, time: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const chord = CHORDS[PROGRESSION[bar]];

    // Bass: root on the beat, fifth on the off-beat.
    if (inBar % 4 === 0) this.note('triangle', freq(chord.root - 12), time, STEP_SEC * 3.5, 0.22);
    else if (inBar % 4 === 2)
      this.note('triangle', freq(chord.root - 5), time, STEP_SEC * 1.5, 0.12);

    // Arpeggio: 16ths up the chord, very quiet.
    this.note('square', freq(chordTone(chord, inBar % 4) + 12), time, STEP_SEC * 0.8, 0.03);

    // Lead: one motif per bar, an octave higher in the second half of each section.
    if (inBar % 2 === 0) {
      const tone = MOTIFS[bar % MOTIFS.length][inBar / 2];
      const lift = bar % 8 >= 4 ? 12 : 0;
      if (tone >= 0)
        this.note('square', freq(chordTone(chord, tone) + 12 + lift), time, STEP_SEC * 1.7, 0.055);
    }
  }

  private note(
    wave: OscillatorType,
    frequency: number,
    time: number,
    sec: number,
    gain: number,
  ): void {
    const ctx = this.mixer.context;
    const bus = this.mixer.musicBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + sec);
    osc.connect(env).connect(bus);
    osc.start(time);
    osc.stop(time + sec + 0.02);
  }
}
