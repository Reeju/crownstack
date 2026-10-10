const MASTER_GAIN = 0.9;

/**
 * Owns the AudioContext and the music / SFX buses. The context is created on
 * the first user gesture, so the game is silent until then (SPEC §5.3) and
 * browsers' autoplay rules are respected.
 */
export class Mixer {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private readonly unlockListeners: (() => void)[] = [];

  constructor() {
    window.addEventListener('pointerdown', this.unlock, { once: true, capture: true });
    window.addEventListener('keydown', this.unlock, { once: true, capture: true });
  }

  /** The context once unlocked, else null: callers simply skip sounds until then. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  get musicBus(): GainNode | null {
    return this.musicGain;
  }

  get sfxBus(): GainNode | null {
    return this.sfxGain;
  }

  /** Runs `listener` once audio is available (immediately if it already is). */
  onUnlock(listener: () => void): void {
    if (this.ctx) listener();
    else this.unlockListeners.push(listener);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain?.gain.setTargetAtTime(music, now, 0.05);
    this.sfxGain?.gain.setTargetAtTime(sfx, now, 0.05);
  }

  /** Silences everything while the tab is hidden. */
  setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    void (suspended ? this.ctx.suspend() : this.ctx.resume());
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.unlock, { capture: true });
    window.removeEventListener('keydown', this.unlock, { capture: true });
    void this.ctx?.close();
    this.ctx = null;
  }

  private readonly unlock = (): void => {
    if (this.ctx) return;
    window.removeEventListener('pointerdown', this.unlock, { capture: true });
    window.removeEventListener('keydown', this.unlock, { capture: true });
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(master);
    this.ctx = ctx;
    void ctx.resume();
    for (const listener of this.unlockListeners.splice(0)) listener();
  };
}
