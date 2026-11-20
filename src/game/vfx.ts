import * as THREE from 'three';
import type { Simulation } from '../core/simulation.js';
import { PULSE_CENTER_Y_OFFSET, TUNING } from '../core/tuning.js';
import { PALETTE } from './scene.js';

interface PulseWave {
  ring: THREE.Mesh;
  dome: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
}

/** Visual effects: 3D pulse dome, dash sparks, burst particles, and Night 3 wind leaves. */
export class VfxSystem {
  private readonly scene: THREE.Scene;
  private readonly pulses: PulseWave[] = [];
  private readonly sparks: SparkParticle[] = [];
  private readonly windLeaves: THREE.Mesh[] = [];
  private readonly sparkGeo = new THREE.SphereGeometry(0.11, 6, 6);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const leafGeo = new THREE.BoxGeometry(0.28, 0.04, 0.14);
    const leafMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.visible = false;
      this.scene.add(m);
      this.windLeaves.push(m);
    }
  }

  spawnPulse(x: number, y: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.0, 42),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.14, z);
    this.scene.add(ring);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    dome.position.set(x, y + PULSE_CENTER_Y_OFFSET, z);
    this.scene.add(dome);

    this.pulses.push({ ring, dome, age: 0, maxAge: 0.5 });
    this.spawnBurst(x, y + 0.9, z, PALETTE.lanternCore, 16, 6.0);
  }

  spawnBurst(x: number, y: number, z: number, color: number, count = 12, speed = 4.2): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat.clone());
      mesh.position.set(x, y, z);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = speed * (0.45 + Math.random() * 0.75);
      const vel = new THREE.Vector3(Math.cos(a) * spd, 1.5 + Math.random() * 3.0, Math.sin(a) * spd);
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, age: 0, maxAge: 0.5 + Math.random() * 0.3 });
    }
  }

  update(dt: number, elapsed: number, sim: Simulation): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.maxAge);
      const ease = 1 - Math.pow(1 - t, 3);
      const r = 0.5 + ease * TUNING.pulse_radius;
      p.ring.scale.set(r, r, 1);
      p.dome.scale.set(r, r, r);
      (p.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      (p.dome.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.25;
      if (p.age >= p.maxAge) {
        this.scene.remove(p.ring, p.dome);
        this.pulses.splice(i, 1);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      s.vel.y -= 7.5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const t = Math.min(1, s.age / s.maxAge);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      s.mesh.scale.setScalar(1 - t * 0.7);
      if (s.age >= s.maxAge) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }

    // Wind leaves on Night 3 during 2s warning and 5s active gust
    const showWind = sim.wind.active || sim.wind.warning;
    const rad = (sim.wind.dirDeg * Math.PI) / 180;
    const wx = Math.cos(rad);
    const wz = Math.sin(rad);
    const speed = sim.wind.active ? 16 : 7;

    this.windLeaves.forEach((leaf, idx) => {
      leaf.visible = showWind;
      if (!showWind) return;
      const cycle = ((elapsed * speed + idx * 2.7) % 30) - 15;
      const side = ((idx % 7) - 3) * 3.8;
      leaf.position.set(
        sim.player.pos[0] + wx * cycle - wz * side,
        sim.player.pos[1] + 1.2 + (idx % 4) * 0.9 + Math.sin(elapsed * 6 + idx) * 0.35,
        sim.player.pos[2] + wz * cycle + wx * side,
      );
      leaf.rotation.set(elapsed * 5 + idx, elapsed * 4, idx);
    });
  }
}
