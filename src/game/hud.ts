import * as THREE from 'three';
import { getLocalIsoString, sortLeaderboard, validatePlayerName, type LeaderboardEntry } from '../core/leaderboard.js';
import { distXZ, round1 } from '../core/rng.js';
import type { Simulation } from '../core/simulation.js';
import { FUEL_LOW_THRESHOLD_UNITS, FUEL_MAX_UNITS, FUEL_UNIT_SCALE, TICK_RATE, TUNING } from '../core/tuning.js';
import type { NightNumber } from '../core/types.js';

export interface UserSettings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

const SETTINGS_KEY = 'dao_den_long_settings_v3';
export const LEADERBOARD_WEB_KEY = 'dao_den_long_leaderboard';

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(100, parsed.volume)) : 70,
        sensitivity: typeof parsed.sensitivity === 'number' ? Math.max(0.3, Math.min(2.5, parsed.sensitivity)) : 1.0,
        colorblind: Boolean(parsed.colorblind),
        largeText: Boolean(parsed.largeText),
        reducedMotion: Boolean(parsed.reducedMotion),
      };
    }
  } catch {
    // Ignore storage restriction
  }
  return { volume: 70, sensitivity: 1.0, colorblind: false, largeText: false, reducedMotion: false };
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
  private readonly cbInput = document.getElementById('input-colorblind') as HTMLInputElement;
  private readonly largeTextInput = document.getElementById('input-large-text') as HTMLInputElement;
  private readonly reducedMotionInput = document.getElementById('input-reduced-motion') as HTMLInputElement;
  private readonly leaderboardEl = document.getElementById('overlay-leaderboard')!;
  private readonly leaderboardTbody = document.getElementById('leaderboard-tbody')!;
  private readonly playerNameInput = document.getElementById('input-player-name') as HTMLInputElement;
  private readonly saveScoreBtn = document.getElementById('btn-save-score') as HTMLButtonElement;
  private readonly saveScoreStatus = document.getElementById('save-score-status')!;
  private readonly projVec = new THREE.Vector3();

  private settingsReturnTo: 'menu' | 'pause' = 'menu';
  private colorblind = false;
  private lastCompletedScore = 0;
  private lastNightsWon = 0;
  private lastSeed = 42;

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

    document.getElementById('btn-menu-leaderboard')?.addEventListener('click', () => this.showLeaderboard('menu'));
    document.getElementById('btn-end-leaderboard')?.addEventListener('click', () => this.showLeaderboard('end'));
    document.getElementById('btn-leaderboard-close')?.addEventListener('click', () => this.closeLeaderboard());

    this.saveScoreBtn?.addEventListener('click', () => this.handleSaveScore());
    this.playerNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSaveScore();
    });

    this.volInput.value = String(Math.round(callbacks.settings.volume));
    this.volLabel.textContent = `${Math.round(callbacks.settings.volume)}%`;
    this.sensInput.value = String(Math.round(callbacks.settings.sensitivity * 100));
    this.sensLabel.textContent = `${callbacks.settings.sensitivity.toFixed(1)}x`;
    this.cbInput.checked = callbacks.settings.colorblind;
    this.largeTextInput.checked = callbacks.settings.largeText;
    this.reducedMotionInput.checked = callbacks.settings.reducedMotion;

    this.applyColorblind(callbacks.settings.colorblind);
    this.applyLargeText(callbacks.settings.largeText);
    this.applyReducedMotion(callbacks.settings.reducedMotion);

    const emitSettings = () => {
      const s: UserSettings = {
        volume: Number(this.volInput.value),
        sensitivity: Number(this.sensInput.value) / 100,
        colorblind: this.cbInput.checked,
        largeText: this.largeTextInput.checked,
        reducedMotion: this.reducedMotionInput.checked,
      };
      this.volLabel.textContent = `${Math.round(s.volume)}%`;
      this.sensLabel.textContent = `${s.sensitivity.toFixed(1)}x`;
      this.applyColorblind(s.colorblind);
      this.applyLargeText(s.largeText);
      this.applyReducedMotion(s.reducedMotion);
      saveSettings(s);
      callbacks.onSettingsChange(s);
    };
    this.volInput.addEventListener('input', emitSettings);
    this.sensInput.addEventListener('input', emitSettings);
    this.cbInput.addEventListener('change', emitSettings);
    this.largeTextInput.addEventListener('change', emitSettings);
    this.reducedMotionInput.addEventListener('change', emitSettings);
  }

  private applyColorblind(cb: boolean): void {
    this.colorblind = cb;
    document.body.classList.toggle('colorblind', cb);
  }

  private applyLargeText(large: boolean): void {
    document.body.classList.toggle('large-text', large);
  }

  private applyReducedMotion(rm: boolean): void {
    document.body.classList.toggle('reduced-motion', rm);
  }

  private leaderboardReturnTo: 'menu' | 'end' = 'menu';

  showLeaderboard(from: 'menu' | 'end'): void {
    this.leaderboardReturnTo = from;
    this.menuEl.classList.add('hidden');
    this.endEl.classList.add('hidden');
    this.renderLeaderboard();
    this.leaderboardEl.classList.remove('hidden');
  }

  closeLeaderboard(): void {
    this.leaderboardEl.classList.add('hidden');
    if (this.leaderboardReturnTo === 'menu') this.menuEl.classList.remove('hidden');
    else this.endEl.classList.remove('hidden');
  }

  private getStoredLeaderboard(): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(LEADERBOARD_WEB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return sortLeaderboard(parsed);
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveStoredLeaderboard(entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(LEADERBOARD_WEB_KEY, JSON.stringify(sortLeaderboard(entries)));
    } catch {
      // ignore
    }
  }

  private renderLeaderboard(): void {
    const entries = this.getStoredLeaderboard();
    if (entries.length === 0) {
      this.leaderboardTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.7;">Chưa có kỷ lục nào. Hãy chơi và lưu điểm!</td></tr>';
      return;
    }
    this.leaderboardTbody.innerHTML = entries
      .map(
        (e, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td><strong>${e.name}</strong></td>
          <td style="color:var(--brand-gold, #ffb347);">${e.score}</td>
          <td>${e.nights_won} / 3</td>
          <td style="font-size:0.85em; opacity:0.8;">${e.achieved_at.replace('T', ' ').slice(0, 19)}</td>
        </tr>
      `,
      )
      .join('');
  }

  private handleSaveScore(): void {
    const rawName = this.playerNameInput.value.trim();
    if (!validatePlayerName(rawName)) {
      this.saveScoreStatus.textContent = 'Tên không hợp lệ (cần 3–12 ký tự chữ/số/gạch dưới).';
      this.saveScoreStatus.style.color = '#ff6b6b';
      return;
    }
    const newEntry: LeaderboardEntry = {
      name: rawName,
      score: this.lastCompletedScore,
      nights_won: this.lastNightsWon,
      achieved_at: getLocalIsoString(),
      seed: this.lastSeed,
    };
    const current = this.getStoredLeaderboard();
    this.saveStoredLeaderboard([...current, newEntry]);
    this.saveScoreStatus.textContent = `Đã lưu kỷ lục của ${rawName}!`;
    this.saveScoreStatus.style.color = '#74c0fc';
    this.saveScoreBtn.disabled = true;
    this.playerNameInput.disabled = true;
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
      document.getElementById('end-title')!.textContent = 'Chúc Mừng! Giữ Đảo Sáng Tới Bình Minh!';
      document.getElementById('end-desc')!.textContent =
        'Mây đã châm dầu và bảo vệ ngọn lửa qua cả 3 Đêm, đón ánh bình minh rực rỡ trên quần đảo.';
      btnPrimary.textContent = 'Chơi Lại Từ Đêm 1';
    } else if (sim.state === 'won') {
      document.getElementById('end-eyebrow')!.textContent = `Sống Sót Qua Đêm ${sim.night}`;
      document.getElementById('end-title')!.textContent = `Bình Minh Đã Tới Trên ${sim.map.name}!`;
      document.getElementById('end-desc')!.textContent = 'Đủ số đèn vẫn sáng rực khi bình minh lên. Sang đảo tiếp theo!';
      btnPrimary.textContent = `Sang Đêm ${sim.night + 1}`;
    } else {
      document.getElementById('end-eyebrow')!.textContent = `Thất Bại · Đêm ${sim.night}`;
      document.getElementById('end-title')!.textContent =
        reason === 'dawn' ? 'Không Đủ Đèn Sáng Khi Bình Minh...' : 'Ngọn Lửa Đã Tắt...';
      document.getElementById('end-desc')!.textContent = 'Hãy châm dầu cho đèn dưới 30% và xua Bóng Mực hút dầu!';
      btnPrimary.textContent = `Chơi Lại Đêm ${sim.night}`;
    }

    document.getElementById('end-stats')!.innerHTML = `
      <div class="end-stat-box"><div class="val">${sim.score}</div><div class="lbl">Điểm Đêm ${sim.night}</div></div>
      <div class="end-stat-box"><div class="val">${campaignTotal}</div><div class="lbl">Tổng điểm</div></div>
      <div class="end-stat-box"><div class="val">${litCount}/${sim.lanterns.length}</div><div class="lbl">Đèn giữ sáng</div></div>
    `;

    // Leaderboard state recording for Ticket-04
    this.lastCompletedScore = campaignTotal > 0 ? campaignTotal : sim.score;
    this.lastNightsWon = sim.state === 'won' ? sim.night : Math.max(0, sim.night - 1);
    this.lastSeed = sim.seed;
    if (this.saveScoreBtn) this.saveScoreBtn.disabled = false;
    if (this.playerNameInput) {
      this.playerNameInput.disabled = false;
      this.playerNameInput.value = '';
    }
    if (this.saveScoreStatus) {
      this.saveScoreStatus.textContent = '';
    }
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
    const warnPrefix = this.colorblind && sim.timeLeftS <= 30 ? '⚠ ' : '';
    this.timerEl.textContent = `${warnPrefix}${mm}:${ss}`;
    this.timerEl.classList.toggle('danger', sim.timeLeftS <= 30);

    const lowLanterns = sim.lanterns.filter((l) => l.lit && l.fuelUnits < FUEL_LOW_THRESHOLD_UNITS);
    if (sim.wind.warning) {
      this.windAlertEl.classList.remove('hidden');
      this.windAlertEl.textContent = `${this.colorblind ? '⚠ ' : ''}Lá bay! Gió mạnh sắp thổi!`;
    } else if (lowLanterns.length > 0) {
      this.windAlertEl.classList.remove('hidden');
      this.windAlertEl.textContent = `${this.colorblind ? '⚠ ' : ''}Đèn sắp cạn dầu: ${lowLanterns.map((l) => l.id).join(', ')}`;
    } else {
      this.windAlertEl.classList.add('hidden');
    }

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    const reqLit = Math.ceil(TUNING.win_ratio * sim.lanterns.length);
    this.lanternCountEl.textContent = `Đèn ${litCount}/${sim.lanterns.length} (cần ≥${reqLit})`;
    this.scoreEl.textContent = String(sim.score);

    // Dynamic capacity bar (10..20)
    this.motesBarEl.style.gridTemplateColumns = `repeat(${sim.player.capacity}, 14px)`;
    this.motesBarEl.innerHTML = Array.from({ length: sim.player.capacity }, (_, i) =>
      `<span class="mote-slot ${i < sim.player.carried ? 'filled' : ''}" style="width:14px"></span>`,
    ).join('');
    this.motesTextEl.textContent = `Đom đóm: ${sim.player.carried} / ${sim.player.capacity}`;

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

    // Selectable lantern for interact prompt (unlit OR lit with fuel < 100)
    let bestInteract = null;
    let bestIDist = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit && l.fuelUnits >= FUEL_MAX_UNITS) continue;
      const d = distXZ(sim.player.pos, l.pos);
      if (d <= TUNING.interact_radius && d < bestIDist) {
        bestIDist = d;
        bestInteract = l;
      }
    }
    if (bestInteract) {
      if (!bestInteract.lit) {
        const cost = bestInteract.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        this.promptEl.textContent = `E — ${bestInteract.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${bestInteract.deposited}/${cost})`;
      } else {
        this.promptEl.textContent = `E — Châm dầu ${bestInteract.id} (${round1(bestInteract.fuelUnits / FUEL_UNIT_SCALE)}/100)`;
      }
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }

    // Offscreen arrow points to nearest unlit or low-fuel lantern
    let targetL = null;
    let bestDist = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit && l.fuelUnits >= FUEL_LOW_THRESHOLD_UNITS) continue;
      const d = distXZ(sim.player.pos, l.pos);
      if (d < bestDist) {
        bestDist = d;
        targetL = l;
      }
    }
    if (targetL) {
      this.projVec.set(targetL.pos[0], targetL.pos[1] + 3.5, targetL.pos[2]).project(camera);
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
        const px = cx + Math.cos(angle) * (cx - 44);
        const py = cy - Math.sin(angle) * (cy - 48);
        this.arrowEl.classList.remove('hidden');
        this.arrowEl.style.left = `${Math.round(px - 18)}px`;
        this.arrowEl.style.top = `${Math.round(py - 20)}px`;
        this.arrowGlyphEl.style.transform = `rotate(${Math.round(90 - (angle * 180) / Math.PI)}deg)`;
        this.arrowLabelEl.textContent = `${targetL.id} · ${Math.round(bestDist)}m`;
      }
    } else {
      this.arrowEl.classList.add('hidden');
    }
  }
}
