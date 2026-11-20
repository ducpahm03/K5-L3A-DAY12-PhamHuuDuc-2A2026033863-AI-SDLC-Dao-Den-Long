import './styles.css';
import * as THREE from 'three';
import { getMapConfig } from '../core/maps.js';
import { Simulation } from '../core/simulation.js';
import { DT } from '../core/tuning.js';
import type { EventRecord, NightNumber } from '../core/types.js';
import { SoundEngine } from './audio.js';
import { InputController } from './controls.js';
import { EntityRenderer } from './entities.js';
import { HudController, loadSettings } from './hud.js';
import { PALETTE, WorldScene } from './scene.js';
import { VfxSystem } from './vfx.js';

type AppMode = 'menu' | 'intro' | 'playing' | 'paused' | 'ended';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 360);
const world = new WorldScene();
const entities = new EntityRenderer(world.scene);
const vfx = new VfxSystem(world.scene);
const sound = new SoundEngine();

const settings = loadSettings();
sound.setVolume(settings.volume / 100);

const params = new URLSearchParams(window.location.search);
const baseSeed = Number.parseInt(params.get('seed') ?? '2026', 10) || 2026;

let currentNight: NightNumber = 1;
let runCounter = 0;
let campaignTotal = 0;
let sim = new Simulation(baseSeed, 1);
let mode: AppMode = 'menu';
let endReason = '';
let accumulator = 0;
let elapsed = 0;
let lastTime = performance.now();
let lastCountdownSec = -1;
let prevWindWarn = false;
let fpsFrames = 0;
let fpsAccumS = 0;
let measuredFps = 60;

const camTarget = new THREE.Vector3(0, 1.5, 0);
const camPos = new THREE.Vector3(0, 6, -11);

const controls = new InputController(canvas, () => {
  if (mode === 'playing') togglePause();
  else if (mode === 'paused') togglePause();
});
controls.sensitivity = settings.sensitivity;

const hud = new HudController({
  settings,
  onStartNight: (night, resetCampaign) => {
    sound.unlock();
    if (resetCampaign) campaignTotal = 0;
    openNightIntro(night);
  },
  onIntroConfirm: () => beginPlayingNight(currentNight),
  onPauseClick: () => {
    if (mode === 'playing') togglePause();
  },
  onResume: () => {
    if (mode === 'paused') togglePause();
  },
  onRestartNight: () => beginPlayingNight(currentNight),
  onBackToMenu: () => {
    mode = 'menu';
    hud.showMenu();
  },
  onSettingsChange: (s) => {
    sound.setVolume(s.volume / 100);
    controls.sensitivity = s.sensitivity;
  },
  onEndPrimary: () => {
    if (sim.state === 'won') {
      if (currentNight < 3) {
        openNightIntro((currentNight + 1) as NightNumber);
      } else {
        campaignTotal = 0;
        openNightIntro(1);
      }
    } else {
      beginPlayingNight(currentNight);
    }
  },
});

function openNightIntro(night: NightNumber): void {
  currentNight = night;
  const cfg = getMapConfig(night);
  world.loadNight(night);
  entities.clearAllDynamic();
  sim = new Simulation(baseSeed + night * 100 + runCounter, night);
  entities.sync(sim, elapsed);
  mode = 'intro';
  hud.showIntro(night, cfg.name, cfg.introLine);
}

function beginPlayingNight(night: NightNumber): void {
  sound.unlock();
  currentNight = night;
  const seed = params.has('seed') ? baseSeed : baseSeed + night * 100 + runCounter;
  runCounter++;
  world.loadNight(night);
  entities.clearAllDynamic();
  sim = new Simulation(seed, night);
  mode = 'playing';
  endReason = '';
  accumulator = 0;
  lastCountdownSec = -1;
  prevWindWarn = false;
  controls.resetCamera();
  hud.showPlaying();
  hud.update(sim, camera);
}

function togglePause(): void {
  if (mode === 'playing') {
    mode = 'paused';
    sim.state = 'paused';
    hud.showPause();
  } else if (mode === 'paused') {
    mode = 'playing';
    sim.state = 'playing';
    hud.showPlaying();
  }
}

function handleEvents(events: EventRecord[]): void {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
        sound.playPickup(sim.player.carried);
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 0.9, sim.player.pos[2], PALETTE.moteCore, 10, 3.5);
        break;
      case 'deposit': {
        sound.playDeposit();
        const l = sim.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (l) vfx.spawnBurst(l.pos[0], l.pos[1] + 3.2, l.pos[2], PALETTE.lanternLit, 12, 4.0);
        break;
      }
      case 'lantern_lit': {
        sound.playLanternLit();
        const l = sim.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (l) vfx.spawnBurst(l.pos[0], l.pos[1] + 3.6, l.pos[2], PALETTE.lanternCore, 26, 7.2);
        break;
      }
      case 'pulse':
        sound.playPulse();
        vfx.spawnPulse(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
        break;
      case 'dash':
        sound.playDash();
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 0.8, sim.player.pos[2], PALETTE.gold, 10, 4.5);
        break;
      case 'charm_picked':
        sound.playCharm();
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 1.0, sim.player.pos[2], PALETTE.mayScarf, 18, 5.5);
        break;
      case 'shade_spawned':
        sound.playShadeSpawn();
        break;
      case 'player_hit':
        sound.playHit();
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 1.0, sim.player.pos[2], PALETTE.shadeRim, 16, 5.0);
        break;
      case 'game_over':
        endReason = String(ev.data.reason ?? '');
        mode = 'ended';
        if (sim.state === 'won') {
          campaignTotal += sim.score;
          sound.playWin();
        } else {
          sound.playLose();
        }
        hud.showEnd(sim, endReason, campaignTotal);
        break;
      default:
        break;
    }
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(window as unknown as Record<string, unknown>).__DAO_DEN_LONG__ = {
  getMode: () => mode,
  getFps: () => measuredFps,
  getSnapshot: () => sim.getSnapshot(),
};

hud.showMenu();
entities.sync(sim, 0);

function frame(now: number): void {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += rawDt;

  fpsFrames++;
  fpsAccumS += rawDt;
  if (fpsAccumS >= 0.5) {
    measuredFps = Math.round(fpsFrames / fpsAccumS);
    fpsFrames = 0;
    fpsAccumS = 0;
  }

  if (mode === 'playing') {
    accumulator += rawDt;
    while (accumulator >= DT && mode === 'playing') {
      const prevGrounded = sim.player.grounded;
      const input = controls.sampleForTick(DT);
      input.pause = false; // UI pause handled by togglePause
      const events = sim.step(input);
      if (prevGrounded && !sim.player.grounded && sim.player.vel[1] > 0) {
        sound.playJump();
      }
      handleEvents(events);
      accumulator -= DT;
    }

    if (sim.wind.warning && !prevWindWarn) {
      sound.playWindWarning();
    }
    prevWindWarn = sim.wind.warning;

    const secLeft = Math.ceil(sim.timeLeftS);
    if (secLeft > 0 && secLeft <= 10 && secLeft !== lastCountdownSec) {
      lastCountdownSec = secLeft;
      sound.playCountdownTick();
    }

    hud.update(sim, camera);
  }

  const litCount = sim.lanterns.filter((l) => l.lit).length;
  const litFrac = litCount / Math.max(1, sim.lanterns.length);
  sound.setLitFraction(litFrac);
  sound.updateAmbient(rawDt, mode === 'playing');

  world.update(rawDt, elapsed, mode === 'menu' || mode === 'intro' ? 0.35 : litFrac);
  entities.sync(sim, elapsed);
  vfx.update(rawDt, elapsed, sim);

  if (mode === 'menu' || mode === 'intro') {
    const orbit = elapsed * 0.14;
    const focusX = currentNight === 2 ? 35 : 0;
    const radius = currentNight === 2 ? 62 : 42;
    camera.position.set(focusX + Math.sin(orbit) * radius, 22, Math.cos(orbit) * radius);
    camera.lookAt(focusX, 2, 0);
  } else {
    const yawRad = (controls.camYawDeg * Math.PI) / 180;
    const dist = 11.0;
    const horiz = Math.cos(controls.camPitchRad) * dist;
    const height = Math.sin(controls.camPitchRad) * dist + 1.8;

    const desiredPos = new THREE.Vector3(
      sim.player.pos[0] - Math.sin(yawRad) * horiz,
      sim.player.pos[1] + height,
      sim.player.pos[2] - Math.cos(yawRad) * horiz,
    );
    const desiredTarget = new THREE.Vector3(sim.player.pos[0], sim.player.pos[1] + 1.5, sim.player.pos[2]);

    const damp = 1 - Math.exp(-rawDt * 10);
    camPos.lerp(desiredPos, damp);
    camTarget.lerp(desiredTarget, damp);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  renderer.render(world.scene, camera);
}

requestAnimationFrame(frame);
