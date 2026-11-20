/** Procedural Web Audio soundscape (Vietnamese pentatonic ambient + fairy-tale SFX). */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private litCount = 0;
  private ambientTimer = 0;
  private noteIdx = 0;

  // D pentatonic scale (Hz): D4, E4, G4, A4, B4, D5, E5, G5
  private readonly scale = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99];

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.35, this.ctx.currentTime, 0.05);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setLitCount(count: number): void {
    this.litCount = count;
  }

  updateAmbient(dt: number, active: boolean): void {
    if (!active || !this.ctx || !this.master || this.muted || this.ctx.state !== 'running') return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    // Faster, brighter gentle chimes as more lanterns light up
    this.ambientTimer = Math.max(0.85, 2.2 - this.litCount * 0.24);
    const maxIdx = Math.min(this.scale.length - 1, 3 + this.litCount);
    const pattern = [0, 2, 3, 1, 4, 2, 5, 3];
    const freq = this.scale[pattern[this.noteIdx % pattern.length] % (maxIdx + 1)];
    this.noteIdx++;
    this.playTone(freq, 'sine', 0.06, 1.4, 0.02);
    if (this.litCount >= 3) {
      this.playTone(freq * 1.5, 'triangle', 0.025, 1.1, 0.05);
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    volume: number,
    duration: number,
    attack = 0.01,
    endFreq?: number,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried: number): void {
    const freq = this.scale[Math.min(this.scale.length - 1, 2 + carried)];
    this.playTone(freq, 'sine', 0.16, 0.35, 0.008, freq * 1.25);
    this.playTone(freq * 2, 'triangle', 0.06, 0.25, 0.01);
  }

  playDeposit(): void {
    this.playTone(440, 'triangle', 0.16, 0.45, 0.01, 587.33);
  }

  playLanternLit(): void {
    const chord = [293.66, 440.0, 587.33, 880.0];
    chord.forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.14, 1.3, 0.02), idx * 55);
    });
  }

  playPulse(): void {
    this.playTone(520, 'sine', 0.22, 0.55, 0.01, 140);
    this.playTone(784, 'triangle', 0.11, 0.4, 0.008, 392);
  }

  playHit(): void {
    this.playTone(170, 'sawtooth', 0.18, 0.35, 0.005, 65);
  }

  playJump(): void {
    this.playTone(260, 'sine', 0.09, 0.18, 0.01, 420);
  }

  playWin(): void {
    const notes = [293.66, 392.0, 440.0, 587.33, 783.99];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.16, 1.2, 0.02), i * 110);
    });
  }

  playLose(): void {
    const notes = [392.0, 329.63, 293.66, 220.0];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.15, 0.9, 0.02), i * 160);
    });
  }
}
