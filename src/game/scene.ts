import * as THREE from 'three';
import { getMapConfig } from '../core/maps.js';
import type { NightNumber } from '../core/types.js';

/** Standard Ticket-02 palette hex constants (<= 10% RGB deviation). */
export const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStun: 0x3a3450,
  mayRobe: 0xe8e2d0,
  mayScarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
} as const;

export class WorldScene {
  public readonly scene = new THREE.Scene();
  private readonly ambientLight: THREE.AmbientLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly mapGroup = new THREE.Group();
  private readonly clouds: Array<{ mesh: THREE.Mesh; angle: number; radius: number; speed: number; baseY: number }> = [];
  private readonly stars: THREE.Points;
  private builtNight: NightNumber | null = null;

  constructor() {
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.011);

    // Ambient intensity strictly follows Ticket-02: 0.15 + 0.55 * (lit / total)
    this.ambientLight = new THREE.AmbientLight(0xdce6ff, 0.15);
    this.scene.add(this.ambientLight);

    this.moonLight = new THREE.DirectionalLight(0xd8e4ff, 0.72);
    this.moonLight.position.set(-45, 70, -40);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 10;
    this.moonLight.shadow.camera.far = 220;
    const d = 65;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.scene.add(this.moonLight);

    this.stars = this.buildStarfield();
    this.buildMoonAndCloudSea();
    this.scene.add(this.mapGroup);
    this.loadNight(1);
  }

  private buildStarfield(): THREE.Points {
    const count = 480;
    const pos = new Float32Array(count * 3);
    let s = 104729;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < count; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(0.12 + rnd() * 0.88);
      const r = 185 + rnd() * 20;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf5f1e6, size: 1.15 }));
    this.scene.add(pts);
    return pts;
  }

  private buildMoonAndCloudSea(): void {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 20), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore }));
    moon.position.set(-70, 82, -95);
    this.scene.add(moon);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshBasicMaterial({ color: PALETTE.cloudSea, transparent: true, opacity: 0.78 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -11;
    this.scene.add(sea);

    const puffGeo = new THREE.SphereGeometry(1, 10, 8);
    const puffMat = new THREE.MeshStandardMaterial({ color: PALETTE.cloudSea, roughness: 1, transparent: true, opacity: 0.52 });
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 52 + (i % 6) * 16;
      const m = new THREE.Mesh(puffGeo, puffMat);
      const sx = 9 + (i % 4) * 5;
      m.scale.set(sx, 2.2, sx * 0.72);
      const baseY = -6.5 - (i % 4) * 1.4;
      m.position.set(Math.cos(a) * r + 20, baseY, Math.sin(a) * r);
      this.scene.add(m);
      this.clouds.push({ mesh: m, angle: a, radius: r, speed: 0.01 + (i % 4) * 0.004, baseY });
    }
  }

  loadNight(night: NightNumber): void {
    if (this.builtNight === night) return;
    this.builtNight = night;
    this.mapGroup.clear();

    const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.9 });
    const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.92 });
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.86 });
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0x26383e, roughness: 0.95, flatShading: true });
    const padMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.lanternLit, emissiveIntensity: 0.65 });

    const addIslandDisk = (cx: number, cz: number, radius: number, topY = 0, thickness = 2.4): void => {
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.8, thickness, 48), grassMat);
      disk.position.set(cx, topY - thickness / 2, cz);
      disk.receiveShadow = true;
      this.mapGroup.add(disk);

      const sandRim = new THREE.Mesh(new THREE.RingGeometry(radius - 2.4, radius, 48), sandMat);
      sandRim.rotation.x = -Math.PI / 2;
      sandRim.position.set(cx, topY + 0.02, cz);
      sandRim.receiveShadow = true;
      this.mapGroup.add(sandRim);

      if (topY === 0) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius + 0.5, 16, 20), cliffMat);
        cone.rotation.x = Math.PI;
        cone.position.set(cx, -thickness - 8, cz);
        this.mapGroup.add(cone);
      }
    };

    const addJumpPads = (n: NightNumber): void => {
      for (const pad of getMapConfig(n).jumpPads) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius * 1.15, 0.22, 20), padMat);
        disc.position.set(pad.pos[0], pad.pos[1] + 0.11, pad.pos[2]);
        this.mapGroup.add(disc);
      }
    };

    if (night === 1) {
      addIslandDisk(0, 0, 40, 0);
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.14, 24), sandMat);
      dais.position.set(0, 0.04, 0);
      this.mapGroup.add(dais);
      for (let i = 0; i < 6; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.9), woodMat);
        plank.position.set(0, 0.04, 34.5 + i * 1.0);
        this.mapGroup.add(plank);
      }
    } else if (night === 2) {
      addIslandDisk(0, 0, 28, 0);
      addIslandDisk(70, 0, 28, 0);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.26, 4), woodMat);
      bridge.position.set(35, -0.1, 0);
      bridge.receiveShadow = true;
      this.mapGroup.add(bridge);
      for (let x = 26.5; x <= 43.5; x += 1.4) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 3.9), sandMat);
        slat.position.set(x, -0.09, 0);
        this.mapGroup.add(slat);
      }
      addJumpPads(2);
    } else {
      addIslandDisk(0, 0, 45, 0);
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.absarc(0, 0, 12, Math.PI, 0, true);
      const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 });
      tier1Geo.rotateX(Math.PI / 2);
      const tier1 = new THREE.Mesh(tier1Geo, grassMat);
      tier1.position.y = 3;
      tier1.receiveShadow = true;
      this.mapGroup.add(tier1);

      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.2, 6, 36), grassMat);
      tier2.position.y = 3;
      tier2.receiveShadow = true;
      this.mapGroup.add(tier2);
      const tier2Rim = new THREE.Mesh(new THREE.RingGeometry(6.8, 8, 36), sandMat);
      tier2Rim.rotation.x = -Math.PI / 2;
      tier2Rim.position.y = 6.02;
      this.mapGroup.add(tier2Rim);

      const rampLen = Math.hypot(6, 3);
      const rampPitch = Math.atan2(3, 6);
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const holder = new THREE.Group();
        holder.position.set(Math.cos(rad) * 27, 1.5, Math.sin(rad) * 27);
        holder.rotation.y = -rad;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.35, 3), woodMat);
        ramp.rotation.z = -rampPitch;
        ramp.receiveShadow = true;
        holder.add(ramp);
        this.mapGroup.add(holder);
      }

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.0, 8, 16), woodMat);
      tower.position.set(0, 10, 0);
      tower.castShadow = true;
      this.mapGroup.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 8), cliffMat);
      roof.position.set(0, 15.1, 0);
      this.mapGroup.add(roof);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 1.0, 12), padMat);
      bell.position.set(0, 12.2, 0);
      this.mapGroup.add(bell);

      addJumpPads(3);
    }
  }

  update(dt: number, elapsed: number, litFraction: number): void {
    this.ambientLight.intensity = 0.15 + 0.55 * litFraction;
    this.stars.rotation.y = elapsed * 0.005;
    for (const c of this.clouds) {
      c.angle += c.speed * dt;
      c.mesh.position.x = Math.cos(c.angle) * c.radius + 20;
      c.mesh.position.z = Math.sin(c.angle) * c.radius;
    }
  }
}
