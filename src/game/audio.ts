/** Procedural Web Audio soundscape covering all Ticket-02 SFX & night ambient. */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private litFraction = 0;
  private ambientTimer = 0;
  private noteIdx = 0;
  private readonly scale = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99];

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.45;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v01: number): void {
    this.volume = Math.max(0, Math.min(1, v01));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.04);
    }
  }

  setLitFraction(frac: number): void {
    this.litFraction = frac;
  }

  updateAmbient(dt: number, active: boolean): void {
    if (!active || !this.ctx || !this.master || this.volume <= 0.001 || this.ctx.state !== 'running') return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = Math.max(0.8, 2.0 - this.litFraction * 1.1);
    const pattern = [0, 2, 3, 1, 4, 2, 5, 3];
    const idx = pattern[this.noteIdx++ % pattern.length];
    const freq = this.scale[idx];
    this.playTone(freq, 'sine', 0.055, 1.35, 0.02);
    if (this.litFraction >= 0.5) {
      this.playTone(freq * 1.5, 'triangle', 0.025, 1.0, 0.04);
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    vol: number,
    duration: number,
    attack = 0.01,
    endFreq?: number,
  ): void {
    if (!this.ctx || !this.master || this.volume <= 0.001) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried: number): void {
    const f = this.scale[Math.min(this.scale.length - 1, carried % this.scale.length)];
    this.playTone(f, 'sine', 0.16, 0.3, 0.008, f * 1.25);
  }

  playDeposit(): void {
    this.playTone(440, 'triangle', 0.15, 0.35, 0.01, 587.33);
  }

  playLanternLit(): void {
    [293.66, 440, 587.33, 880].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.14, 1.2, 0.02), i * 55));
  }

  playPulse(): void {
    this.playTone(540, 'sine', 0.22, 0.5, 0.01, 140);
    this.playTone(784, 'triangle', 0.12, 0.38, 0.01, 392);
  }

  playDash(): void {
    this.playTone(320, 'triangle', 0.14, 0.22, 0.008, 680);
  }

  playCharm(): void {
    [587.33, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.13, 0.45, 0.01), i * 45));
  }

  playHit(): void {
    this.playTone(170, 'sawtooth', 0.18, 0.35, 0.005, 65);
  }

  playJump(): void {
    this.playTone(260, 'sine', 0.1, 0.18, 0.01, 440);
  }

  playShadeSpawn(): void {
    this.playTone(120, 'sine', 0.12, 0.65, 0.05, 85);
  }

  playWindWarning(): void {
    this.playTone(240, 'sine', 0.09, 0.9, 0.2, 390);
  }

  playCountdownTick(): void {
    this.playTone(880, 'square', 0.07, 0.09, 0.005);
  }

  playWin(): void {
    [293.66, 392, 440, 587.33, 783.99].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 'triangle', 0.15, 1.1, 0.02), i * 110),
    );
  }

  playLose(): void {
    [392, 329.63, 293.66, 220].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.14, 0.85, 0.02), i * 150));
  }
}
