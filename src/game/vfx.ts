import * as THREE from 'three';
import type { Simulation } from '../core/simulation.js';
import { TUNING } from '../core/tuning.js';

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

export class VfxSystem {
  private readonly scene: THREE.Scene;
  private readonly pulses: PulseWave[] = [];
  private readonly sparks: SparkParticle[] = [];
  private readonly guideWisps: THREE.Mesh[] = [];
  private readonly sparkGeo = new THREE.SphereGeometry(0.11, 6, 6);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const wispMat = new THREE.MeshBasicMaterial({ color: 0xffd77d, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), wispMat);
      m.visible = false;
      this.scene.add(m);
      this.guideWisps.push(m);
    }
  }

  spawnPulse(x: number, y: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffd778,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.14, z);
    this.scene.add(ring);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffbe54,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    dome.position.set(x, y + 0.8, z);
    this.scene.add(dome);

    this.pulses.push({ ring, dome, age: 0, maxAge: 0.55 });
    this.spawnBurst(x, y + 1, z, 0xffe296, 18, 6.5);
  }

  spawnBurst(x: number, y: number, z: number, color: number, count = 12, speed = 4.2): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, mat.clone());
      mesh.position.set(x, y, z);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = speed * (0.45 + Math.random() * 0.75);
      const vel = new THREE.Vector3(Math.cos(a) * spd, 1.8 + Math.random() * 3.2, Math.sin(a) * spd);
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, age: 0, maxAge: 0.55 + Math.random() * 0.35 });
    }
  }

  update(dt: number, elapsed: number, sim: Simulation): void {
    // 1. Pulse waves expanding to TUNING.pulse_radius
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.maxAge);
      const ease = 1 - Math.pow(1 - t, 3);
      const r = 0.5 + ease * TUNING.pulse_radius;
      p.ring.scale.set(r, r, 1);
      p.dome.scale.set(r, r * 0.55, r);
      (p.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      (p.dome.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.25;
      if (p.age >= p.maxAge) {
        this.scene.remove(p.ring, p.dome);
        this.pulses.splice(i, 1);
      }
    }

    // 2. Spark bursts
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      s.vel.y -= 7.5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const t = Math.min(1, s.age / s.maxAge);
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - t;
      s.mesh.scale.setScalar(1 - t * 0.7);
      if (s.age >= s.maxAge) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }

    // 3. Guiding wind wisps drifting from Mây toward nearest unlit lantern
    let nearest = null;
    let bestDist = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(l.pos[0] - sim.player.pos[0], l.pos[2] - sim.player.pos[2]);
      if (d < bestDist) {
        bestDist = d;
        nearest = l;
      }
    }

    if (!nearest || sim.state !== 'playing') {
      for (const w of this.guideWisps) w.visible = false;
      return;
    }

    const dx = nearest.pos[0] - sim.player.pos[0];
    const dz = nearest.pos[2] - sim.player.pos[2];
    const len = Math.max(0.01, Math.hypot(dx, dz));
    const nx = dx / len;
    const nz = dz / len;
    const px = -nz;
    const pz = nx;

    this.guideWisps.forEach((w, idx) => {
      w.visible = true;
      const frac = ((elapsed * 0.55 + idx / this.guideWisps.length) % 1);
      const reach = Math.min(len, 10.5) * frac;
      const sway = Math.sin(elapsed * 4 + idx * 1.4) * 0.65 * Math.sin(frac * Math.PI);
      w.position.set(
        sim.player.pos[0] + nx * reach + px * sway,
        1.15 + Math.sin(frac * Math.PI) * 0.9,
        sim.player.pos[2] + nz * reach + pz * sway,
      );
      w.scale.setScalar(0.55 + Math.sin(frac * Math.PI) * 0.65);
    });
  }
}
