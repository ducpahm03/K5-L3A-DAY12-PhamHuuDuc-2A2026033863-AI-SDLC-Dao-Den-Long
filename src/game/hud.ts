import type { Simulation } from '../core/simulation.js';
import { distXZ } from '../core/rng.js';
import { TUNING } from '../core/tuning.js';

export class HudController {
  private readonly hudEl = document.getElementById('hud')!;
  private readonly titleEl = document.getElementById('overlay-title')!;
  private readonly endEl = document.getElementById('overlay-end')!;
  private readonly flamesEl = document.getElementById('hud-flames')!;
  private readonly carriedEl = document.getElementById('hud-carried')!;
  private readonly scoreEl = document.getElementById('hud-score')!;
  private readonly lanternsEl = document.getElementById('hud-lanterns')!;
  private readonly timerEl = document.getElementById('hud-timer')!;
  private readonly compassEl = document.getElementById('hud-compass')!;
  private readonly promptEl = document.getElementById('hud-prompt')!;
  private readonly pulseEl = document.getElementById('hud-pulse')!;
  private readonly pulseTextEl = document.getElementById('hud-pulse-text')!;
  private readonly audioBtn = document.getElementById('btn-audio')!;
  private readonly lockBtn = document.getElementById('btn-lock')!;

  private readonly endEyebrowEl = document.getElementById('end-eyebrow')!;
  private readonly endTitleEl = document.getElementById('end-title')!;
  private readonly endDescEl = document.getElementById('end-desc')!;
  private readonly endStatsEl = document.getElementById('end-stats')!;

  constructor(callbacks: {
    onStart: () => void;
    onReplay: () => void;
    onToggleAudio: () => void;
    onToggleLock: () => void;
  }) {
    document.getElementById('btn-start')!.addEventListener('click', callbacks.onStart);
    document.getElementById('btn-replay')!.addEventListener('click', callbacks.onReplay);
    document.getElementById('btn-restart-hud')!.addEventListener('click', callbacks.onReplay);
    this.audioBtn.addEventListener('click', callbacks.onToggleAudio);
    this.lockBtn.addEventListener('click', callbacks.onToggleLock);
  }

  showTitle(): void {
    this.titleEl.classList.remove('hidden');
    this.hudEl.classList.add('hidden');
    this.endEl.classList.add('hidden');
  }

  showPlaying(): void {
    this.titleEl.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    this.endEl.classList.add('hidden');
  }

  setAudioLabel(muted: boolean): void {
    this.audioBtn.textContent = muted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật';
  }

  setLockLabel(locked: boolean): void {
    this.lockBtn.textContent = locked ? 'Khóa chuột: Bật (ESC thoát)' : 'Khóa chuột: Tắt';
  }

  update(sim: Simulation, camYawDeg: number): void {
    // Flames
    this.flamesEl.innerHTML = Array.from({ length: TUNING.flames }, (_, i) =>
      `<span class="flame-pip ${i < sim.player.flames ? '' : 'off'}"></span>`,
    ).join('');

    // Carried motes
    this.carriedEl.innerHTML = Array.from({ length: TUNING.carry_capacity }, (_, i) =>
      `<span class="mote-pip ${i < sim.player.carried ? '' : 'off'}"></span>`,
    ).join('');

    this.scoreEl.textContent = String(sim.score);

    // Lanterns
    this.lanternsEl.innerHTML = sim.lanterns
      .map(
        (l) =>
          `<div class="lantern-pip ${l.lit ? 'lit' : ''}">${l.id}${l.lit ? '' : ` ${l.deposited}/${TUNING.lantern_cost}`}</div>`,
      )
      .join('');

    // Clock MM:SS
    const secs = Math.max(0, Math.ceil(sim.timeLeftS));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;

    // Mini-compass toward nearest unlit lantern relative to camera view
    let nearest = null;
    let bestDist = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit) continue;
      const d = distXZ(sim.player.pos, l.pos);
      if (d < bestDist) {
        bestDist = d;
        nearest = l;
      }
    }
    if (nearest) {
      const targetAngleDeg = (Math.atan2(nearest.pos[0] - sim.player.pos[0], nearest.pos[2] - sim.player.pos[2]) * 180) / Math.PI;
      let rel = ((targetAngleDeg - camYawDeg + 540) % 360) - 180;
      const arrow = rel > 35 ? '←' : rel < -35 ? '→' : '↑';
      this.compassEl.textContent = `${arrow} ${nearest.id} (${Math.round(bestDist)}m)`;
    } else {
      this.compassEl.textContent = 'Tất cả đèn đã sáng!';
    }

    // Contextual interact prompt
    if (nearest && bestDist <= TUNING.interact_radius) {
      if (sim.player.carried > 0) {
        this.promptEl.textContent = `Nhấn [E] để nạp ánh sáng vào Đèn ${nearest.id} (${nearest.deposited}/${TUNING.lantern_cost})`;
      } else {
        this.promptEl.textContent = `Đèn ${nearest.id} cần thêm đom đóm (${nearest.deposited}/${TUNING.lantern_cost})`;
      }
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }

    // Pulse status
    const pulseReady = sim.player.pulseCooldown <= 0.01 && sim.player.carried >= TUNING.pulse_cost;
    this.pulseEl.classList.toggle('ready', pulseReady);
    if (sim.player.pulseCooldown > 0.01) {
      this.pulseTextEl.textContent = `Hồi chiêu ${sim.player.pulseCooldown.toFixed(1)}s`;
    } else if (sim.player.carried < TUNING.pulse_cost) {
      this.pulseTextEl.textContent = `Cần ${TUNING.pulse_cost} đom đóm để Tỏa sáng`;
    } else {
      this.pulseTextEl.textContent = 'Tỏa sáng sẵn sàng!';
    }
  }

  showEnd(sim: Simulation, reason: string): void {
    this.endEl.classList.remove('hidden');
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    if (sim.state === 'won') {
      this.endEyebrowEl.textContent = 'Chiến Thắng · Đêm 1';
      this.endTitleEl.textContent = 'Đảo Bến Đã Bừng Sáng!';
      this.endDescEl.textContent =
        'Tất cả 5 Đèn Lồng Lớn đã rực sáng, xua tan màn sương mực và đón ánh bình minh cổ tích về với hòn đảo.';
    } else {
      this.endEyebrowEl.textContent = 'Thất Bại · Đêm 1';
      this.endTitleEl.textContent = reason === 'dawn' ? 'Bình Minh Đến Quá Sớm...' : 'Ngọn Lửa Của Mây Đã Tắt...';
      this.endDescEl.textContent =
        reason === 'dawn'
          ? 'Thời gian Đêm 1 đã hết trước khi 5 Đèn Lồng Lớn được thắp sáng. Hãy thử lại nhé!'
          : 'Bóng Mực đã dập tắt hết lửa hộ thân của Mây. Hãy dùng Tỏa Sáng và núp quanh đèn đã thắp!';
    }

    this.endStatsEl.innerHTML = `
      <div class="end-stat-box"><div class="val">${sim.score}</div><div class="lbl">Điểm số</div></div>
      <div class="end-stat-box"><div class="val">${litCount}/${sim.lanterns.length}</div><div class="lbl">Đèn đã thắp</div></div>
      <div class="end-stat-box"><div class="val">${Math.ceil(sim.timeLeftS)}s</div><div class="lbl">Thời gian còn</div></div>
    `;
  }
}
