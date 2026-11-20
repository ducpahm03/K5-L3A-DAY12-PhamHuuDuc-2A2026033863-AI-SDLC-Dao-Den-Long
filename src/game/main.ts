import './styles.css';
import * as THREE from 'three';
import { Simulation } from '../core/simulation.js';
import { DT } from '../core/tuning.js';
import type { EventRecord } from '../core/types.js';
import { SoundEngine } from './audio.js';
import { InputController } from './controls.js';
import { EntityRenderer } from './entities.js';
import { HudController } from './hud.js';
import { WorldScene } from './scene.js';
import { VfxSystem } from './vfx.js';

type AppMode = 'title' | 'playing' | 'ended';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);

const world = new WorldScene();
const entities = new EntityRenderer(world.scene);
const vfx = new VfxSystem(world.scene);
const sound = new SoundEngine();

const params = new URLSearchParams(window.location.search);
const baseSeed = Number.parseInt(params.get('seed') ?? '2026', 10) || 2026;

let runCounter = 0;
let sim = new Simulation(baseSeed);
let mode: AppMode = 'title';
let endReason = '';
let accumulator = 0;
let elapsed = 0;
let lastTime = performance.now();
const camTarget = new THREE.Vector3(0, 1.5, 0);
const camPos = new THREE.Vector3(0, 6, -11);

const hud = new HudController({
  onStart: () => startNewRun(),
  onReplay: () => startNewRun(),
  onToggleAudio: () => {
    sound.unlock();
    sound.setMuted(!sound.isMuted());
    hud.setAudioLabel(sound.isMuted());
  },
  onToggleLock: () => controls.togglePointerLock(),
});

const controls = new InputController(canvas, (locked) => hud.setLockLabel(locked));

function startNewRun(): void {
  sound.unlock();
  const seed = params.has('seed') ? baseSeed : baseSeed + runCounter;
  runCounter++;
  sim = new Simulation(seed);
  mode = 'playing';
  endReason = '';
  accumulator = 0;
  controls.resetCamera();
  hud.showPlaying();
  hud.update(sim, controls.camYawDeg);
}

function handleEvents(events: EventRecord[]): void {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
        sound.playPickup(sim.player.carried);
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 1.0, sim.player.pos[2], 0xffe48a, 10, 3.5);
        break;
      case 'deposit': {
        sound.playDeposit();
        const l = sim.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (l) vfx.spawnBurst(l.pos[0], 3.2, l.pos[2], 0xffbe5c, 12, 4.0);
        break;
      }
      case 'lantern_lit': {
        sound.playLanternLit();
        const l = sim.lanterns.find((x) => x.id === ev.data.lantern_id);
        if (l) vfx.spawnBurst(l.pos[0], 3.6, l.pos[2], 0xffe89e, 28, 7.5);
        break;
      }
      case 'pulse':
        sound.playPulse();
        vfx.spawnPulse(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
        break;
      case 'player_hit':
        sound.playHit();
        vfx.spawnBurst(sim.player.pos[0], sim.player.pos[1] + 1.0, sim.player.pos[2], 0xb175ff, 18, 5.2);
        break;
      case 'game_over':
        endReason = String(ev.data.reason ?? '');
        mode = 'ended';
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        if (sim.state === 'won') sound.playWin();
        else sound.playLose();
        hud.showEnd(sim, endReason);
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

// Read-only state hook for automated visual proof inspection
(window as unknown as Record<string, unknown>).__DAO_DEN_LONG__ = {
  getMode: () => mode,
  getSnapshot: () => sim.getSnapshot(),
};

hud.showTitle();
entities.sync(sim, 0);

function frame(now: number): void {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += rawDt;

  if (mode === 'playing') {
    accumulator += rawDt;
    while (accumulator >= DT && sim.state === 'playing') {
      const prevY = sim.player.pos[1];
      const input = controls.sampleForTick(DT);
      const events = sim.step(input);
      if (prevY <= 0.001 && sim.player.pos[1] > 0.001) {
        sound.playJump();
      }
      handleEvents(events);
      accumulator -= DT;
    }
    hud.update(sim, controls.camYawDeg);
  }

  const litCount = sim.lanterns.filter((l) => l.lit).length;
  const litFrac = litCount / Math.max(1, sim.lanterns.length);
  sound.setLitCount(litCount);
  sound.updateAmbient(rawDt, mode === 'playing');

  world.update(rawDt, elapsed, mode === 'title' ? 0.35 : litFrac);
  entities.sync(sim, elapsed);
  vfx.update(rawDt, elapsed, sim);

  if (mode === 'title') {
    const orbit = elapsed * 0.14;
    camera.position.set(Math.sin(orbit) * 34, 15 + Math.sin(elapsed * 0.35) * 1.5, Math.cos(orbit) * 34);
    camera.lookAt(0, 2.2, 0);
  } else {
    // Camera sits behind player along (-sin(yaw), height, -cos(yaw)) to align 100% with Test Contract cam_yaw_deg
    const yawRad = (controls.camYawDeg * Math.PI) / 180;
    const dist = 10.5;
    const horiz = Math.cos(controls.camPitchRad) * dist;
    const height = Math.sin(controls.camPitchRad) * dist + 1.8;

    const desiredPos = new THREE.Vector3(
      sim.player.pos[0] - Math.sin(yawRad) * horiz,
      sim.player.pos[1] + height,
      sim.player.pos[2] - Math.cos(yawRad) * horiz,
    );
    const desiredTarget = new THREE.Vector3(sim.player.pos[0], sim.player.pos[1] + 1.45, sim.player.pos[2]);

    const damp = 1 - Math.exp(-rawDt * 10);
    camPos.lerp(desiredPos, damp);
    camTarget.lerp(desiredTarget, damp);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  renderer.render(world.scene, camera);
}

requestAnimationFrame(frame);
