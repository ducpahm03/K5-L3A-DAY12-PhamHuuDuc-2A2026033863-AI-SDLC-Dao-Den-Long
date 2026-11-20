import * as THREE from 'three';
import { distXZ } from '../core/rng.js';
import type { Simulation } from '../core/simulation.js';
import { TICK_RATE, TUNING } from '../core/tuning.js';
import type { NightNumber } from '../core/types.js';

export interface UserSettings {
  volume: number; // 0..100
  sensitivity: number; // 0.3..2.5
}

const SETTINGS_KEY = 'dao_den_long_settings_v1';

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(100, parsed.volume)) : 70,
        sensitivity: typeof parsed.sensitivity === 'number' ? Math.max(0.3, Math.min(2.5, parsed.sensitivity)) : 1.0,
      };
    }
  } catch {
    // Ignore storage restriction
  }
  return { volume: 70, sensitivity: 1.0 };
}

export function saveSettings(s: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Ignore storage restriction
  }
}

export class HudController {
  private readonly hudEl = document.getElementById('hud')!;
  private readonly menuEl = document.getElementById('overlay-menu')!;
  private readonly introEl = document.getElementById('overlay-intro')!;
  private readonly pauseEl = document.getElementById('overlay-pause')!;
  private readonly settingsEl = document.getElementById('overlay-settings')!;
  private readonly endEl = document.getElementById('overlay-end')!;

  private readonly flamesEl = document.getElementById('hud-flames')!;
  private readonly charmBadgeEl = document.getElementById('hud-charm-badge')!;
  private readonly nightNameEl = document.getElementById('hud-night-name')!;
  private readonly timerEl = document.getElementById('hud-timer')!;
  private readonly windAlertEl = document.getElementById('hud-wind-alert')!;
  private readonly lanternCountEl = document.getElementById('hud-lantern-count')!;
  private readonly scoreEl = document.getElementById('hud-score')!;
  private readonly promptEl = document.getElementById('hud-prompt')!;
  private readonly motesBarEl = document.getElementById('hud-motes-bar')!;
  private readonly motesTextEl = document.getElementById('hud-motes-text')!;
  private readonly dashCardEl = document.getElementById('hud-dash-cd')!;
  private readonly dashValEl = document.getElementById('hud-dash-val')!;
  private readonly pulseCardEl = document.getElementById('hud-pulse-cd')!;
  private readonly pulseValEl = document.getElementById('hud-pulse-val')!;
  private readonly arrowEl = document.getElementById('offscreen-arrow')!;
  private readonly arrowGlyphEl = this.arrowEl.querySelector('.arrow-glyph') as HTMLElement;
  private readonly arrowLabelEl = document.getElementById('offscreen-arrow-label')!;

  private readonly volInput = document.getElementById('input-volume') as HTMLInputElement;
  private readonly volLabel = document.getElementById('label-volume')!;
  private readonly sensInput = document.getElementById('input-sens') as HTMLInputElement;
  private readonly sensLabel = document.getElementById('label-sens')!;
  private readonly projVec = new THREE.Vector3();

  private settingsReturnTo: 'menu' | 'pause' = 'menu';

  constructor(callbacks: {
    settings: UserSettings;
    onStartNight: (night: NightNumber, resetCampaign: boolean) => void;
    onIntroConfirm: () => void;
    onPauseClick: () => void;
    onResume: () => void;
    onRestartNight: () => void;
    onBackToMenu: () => void;
    onSettingsChange: (s: UserSettings) => void;
    onEndPrimary: () => void;
  }) {
    document.getElementById('btn-play-campaign')!.addEventListener('click', () => callbacks.onStartNight(1, true));
    document.querySelectorAll<HTMLButtonElement>('.chip-btn[data-night]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.night) as NightNumber;
        callbacks.onStartNight(n, false);
      });
    });
    document.getElementById('btn-intro-go')!.addEventListener('click', callbacks.onIntroConfirm);
    document.getElementById('btn-pause-hud')!.addEventListener('click', callbacks.onPauseClick);
    document.getElementById('btn-resume')!.addEventListener('click', callbacks.onResume);
    document.getElementById('btn-pause-restart')!.addEventListener('click', callbacks.onRestartNight);
    document.getElementById('btn-pause-menu')!.addEventListener('click', callbacks.onBackToMenu);
    document.getElementById('btn-end-primary')!.addEventListener('click', callbacks.onEndPrimary);
    document.getElementById('btn-end-menu')!.addEventListener('click', callbacks.onBackToMenu);

    document.getElementById('btn-menu-settings')!.addEventListener('click', () => this.openSettings('menu'));
    document.getElementById('btn-pause-settings')!.addEventListener('click', () => this.openSettings('pause'));
    document.getElementById('btn-settings-close')!.addEventListener('click', () => this.closeSettings());

    this.volInput.value = String(Math.round(callbacks.settings.volume));
    this.volLabel.textContent = `${Math.round(callbacks.settings.volume)}%`;
    this.sensInput.value = String(Math.round(callbacks.settings.sensitivity * 100));
    this.sensLabel.textContent = `${callbacks.settings.sensitivity.toFixed(1)}x`;

    const emitSettings = () => {
      const s: UserSettings = {
        volume: Number(this.volInput.value),
        sensitivity: Number(this.sensInput.value) / 100,
      };
      this.volLabel.textContent = `${Math.round(s.volume)}%`;
      this.sensLabel.textContent = `${s.sensitivity.toFixed(1)}x`;
      saveSettings(s);
      callbacks.onSettingsChange(s);
    };
    this.volInput.addEventListener('input', emitSettings);
    this.sensInput.addEventListener('input', emitSettings);
  }

  private hideAll(): void {
    this.hudEl.classList.add('hidden');
    this.menuEl.classList.add('hidden');
    this.introEl.classList.add('hidden');
    this.pauseEl.classList.add('hidden');
    this.settingsEl.classList.add('hidden');
    this.endEl.classList.add('hidden');
    this.arrowEl.classList.add('hidden');
  }

  showMenu(): void {
    this.hideAll();
    this.menuEl.classList.remove('hidden');
  }

  showIntro(night: NightNumber, title: string, quote: string): void {
    this.hideAll();
    document.getElementById('intro-eyebrow')!.textContent = `Đêm ${night} / 3`;
    document.getElementById('intro-title')!.textContent = title;
    document.getElementById('intro-quote')!.textContent = quote;
    this.introEl.classList.remove('hidden');
  }

  showPlaying(): void {
    this.hideAll();
    this.hudEl.classList.remove('hidden');
  }

  showPause(): void {
    this.pauseEl.classList.remove('hidden');
    this.settingsEl.classList.add('hidden');
  }

  openSettings(from: 'menu' | 'pause'): void {
    this.settingsReturnTo = from;
    this.menuEl.classList.add('hidden');
    this.pauseEl.classList.add('hidden');
    this.settingsEl.classList.remove('hidden');
  }

  closeSettings(): void {
    this.settingsEl.classList.add('hidden');
    if (this.settingsReturnTo === 'menu') this.menuEl.classList.remove('hidden');
    else this.pauseEl.classList.remove('hidden');
  }

  showEnd(sim: Simulation, reason: string, campaignTotal: number): void {
    this.hudEl.classList.add('hidden');
    this.arrowEl.classList.add('hidden');
    this.endEl.classList.remove('hidden');

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    const isFinalWin = sim.state === 'won' && sim.night === 3;
    const btnPrimary = document.getElementById('btn-end-primary')!;

    if (isFinalWin) {
      document.getElementById('end-eyebrow')!.textContent = 'Bình Minh Trên Ba Hòn Đảo';
      document.getElementById('end-title')!.textContent = 'Chúc Mừng! Cả Ba Đảo Đã Sáng!';
      document.getElementById('end-desc')!.textContent =
        'Mây đã thắp sáng trọn vẹn Đảo Bến, Đảo Cau và Đảo Chuông, xua tan màn sương mực đón bình minh ấm áp.';
      btnPrimary.textContent = 'Chơi Lại Từ Đêm 1';
    } else if (sim.state === 'won') {
      document.getElementById('end-eyebrow')!.textContent = `Hoàn Thành Đêm ${sim.night}`;
      document.getElementById('end-title')!.textContent = `${sim.map.name} Đã Sáng!`;
      document.getElementById('end-desc')!.textContent = 'Sẵn sàng chèo thuyền sang hòn đảo tiếp theo!';
      btnPrimary.textContent = `Sang Đêm ${sim.night + 1}`;
    } else {
      document.getElementById('end-eyebrow')!.textContent = `Thất Bại · Đêm ${sim.night}`;
      document.getElementById('end-title')!.textContent =
        reason === 'dawn' ? 'Hết Giờ Trước Bình Minh...' : 'Ngọn Lửa Đã Tắt...';
      document.getElementById('end-desc')!.textContent = 'Bạn có thể chơi lại ngay Đêm này để thử chiến thuật khác.';
      btnPrimary.textContent = `Chơi Lại Đêm ${sim.night}`;
    }

    document.getElementById('end-stats')!.innerHTML = `
      <div class="end-stat-box"><div class="val">${sim.score}</div><div class="lbl">Điểm Đêm ${sim.night}</div></div>
      <div class="end-stat-box"><div class="val">${campaignTotal}</div><div class="lbl">Tổng điểm</div></div>
      <div class="end-stat-box"><div class="val">${litCount}/${sim.lanterns.length}</div><div class="lbl">Đèn đã sáng</div></div>
    `;
  }

  update(sim: Simulation, camera: THREE.PerspectiveCamera): void {
    this.flamesEl.innerHTML = Array.from({ length: TUNING.flames }, (_, i) =>
      `<span class="flame-pip ${i < sim.player.flames ? '' : 'off'}"></span>`,
    ).join('');

    if (sim.player.charmTicks > 0) {
      this.charmBadgeEl.classList.remove('hidden');
      this.charmBadgeEl.textContent = `Bùa Gió: ${(sim.player.charmTicks / TICK_RATE).toFixed(1)}s`;
    } else {
      this.charmBadgeEl.classList.add('hidden');
    }

    this.nightNameEl.textContent = sim.map.name;
    const secs = Math.max(0, Math.ceil(sim.timeLeftS));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;
    this.timerEl.classList.toggle('danger', sim.timeLeftS <= 30);

    if (sim.wind.warning) {
      this.windAlertEl.classList.remove('hidden');
      this.windAlertEl.textContent = 'Lá bay! Cơn gió mạnh sắp ập tới...';
    } else if (sim.wind.active) {
      this.windAlertEl.classList.remove('hidden');
      this.windAlertEl.textContent = 'Gió mạnh đang thổi!';
    } else {
      this.windAlertEl.classList.add('hidden');
    }

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    this.lanternCountEl.textContent = `Đèn ${litCount}/${sim.lanterns.length}`;
    this.scoreEl.textContent = String(sim.score);

    // 10-slot carried mote bar
    this.motesBarEl.innerHTML = Array.from({ length: TUNING.carry_capacity }, (_, i) =>
      `<span class="mote-slot ${i < sim.player.carried ? 'filled' : ''}"></span>`,
    ).join('');
    this.motesTextEl.textContent = `Đom đóm: ${sim.player.carried} / ${TUNING.carry_capacity}`;

    // Dash & Pulse cooldown cards
    const dashReady = sim.player.dashCdTicks === 0 || sim.player.charmTicks > 0;
    this.dashCardEl.classList.toggle('ready', dashReady);
    this.dashValEl.textContent = sim.player.charmTicks > 0
      ? 'Bùa: 0s'
      : dashReady
        ? 'Sẵn sàng'
        : `${(sim.player.dashCdTicks / TICK_RATE).toFixed(1)}s`;

    const pulseReady = sim.player.pulseCdTicks === 0 && sim.player.carried >= TUNING.pulse_cost;
    this.pulseCardEl.classList.toggle('ready', pulseReady);
    this.pulseValEl.textContent = sim.player.pulseCdTicks > 0
      ? `${(sim.player.pulseCdTicks / TICK_RATE).toFixed(1)}s`
      : sim.player.carried < TUNING.pulse_cost
        ? `Cần ${TUNING.pulse_cost}`
        : 'Sẵn sàng';

    // Nearest unlit lantern prompt & offscreen screen-edge arrow
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

    if (nearest && bestDist <= TUNING.interact_radius) {
      this.promptEl.textContent = `E — Nạp ánh sáng (${nearest.deposited}/${TUNING.lantern_cost})`;
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }

    if (nearest) {
      this.projVec.set(nearest.pos[0], nearest.pos[1] + 3.5, nearest.pos[2]).project(camera);
      const onScreen =
        this.projVec.z >= -1 &&
        this.projVec.z <= 1 &&
        Math.abs(this.projVec.x) <= 0.92 &&
        Math.abs(this.projVec.y) <= 0.88;
      if (onScreen) {
        this.arrowEl.classList.add('hidden');
      } else {
        let sx = this.projVec.x;
        let sy = this.projVec.y;
        if (this.projVec.z > 1) {
          sx = -sx;
          sy = -sy;
        }
        const angle = Math.atan2(sy, sx);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const rx = cx - 44;
        const ry = cy - 48;
        const px = cx + Math.cos(angle) * rx;
        const py = cy - Math.sin(angle) * ry;
        this.arrowEl.classList.remove('hidden');
        this.arrowEl.style.left = `${Math.round(px - 18)}px`;
        this.arrowEl.style.top = `${Math.round(py - 20)}px`;
        this.arrowGlyphEl.style.transform = `rotate(${Math.round(90 - (angle * 180) / Math.PI)}deg)`;
        this.arrowLabelEl.textContent = `${nearest.id} · ${Math.round(bestDist)}m`;
      }
    } else {
      this.arrowEl.classList.add('hidden');
    }
  }
}
