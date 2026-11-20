import * as THREE from 'three';
import type { Simulation } from '../core/simulation.js';
import { TUNING } from '../core/tuning.js';

interface LanternVisual {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  beacon: THREE.Mesh;
  safeRing: THREE.Mesh;
  depositPips: THREE.Mesh[];
}

interface ShadeVisual {
  group: THREE.Group;
  coreMat: THREE.MeshStandardMaterial;
  tendrils: THREE.Mesh[];
  stunRing: THREE.Mesh;
}

export class EntityRenderer {
  private readonly scene: THREE.Scene;

  // Player (Mây)
  public readonly playerGroup = new THREE.Group();
  private readonly cloakMesh: THREE.Mesh;
  private readonly hatGroup = new THREE.Group();
  private readonly danglingLantern = new THREE.Group();
  private readonly playerLight: THREE.PointLight;
  private readonly carriedOrbs: THREE.Mesh[] = [];
  private prevPlayerX = 0;
  private prevPlayerZ = 0;
  private facingYaw = 0;

  private readonly lanternMap = new Map<string, LanternVisual>();
  private readonly shadeMap = new Map<string, ShadeVisual>();
  private readonly moteMap = new Map<string, THREE.Group>();

  private readonly moteGeo = new THREE.SphereGeometry(0.24, 12, 12);
  private readonly moteMat = new THREE.MeshBasicMaterial({ color: 0xffe48a });
  private readonly moteHaloGeo = new THREE.SphereGeometry(0.46, 12, 12);
  private readonly moteHaloMat = new THREE.MeshBasicMaterial({
    color: 0xffa838,
    transparent: true,
    opacity: 0.34,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Build Mây — warm tunic, flowing indigo-teal cloak, nón lá with dangling glowing mini-lantern
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4ead5, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.85, 12), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    this.playerGroup.add(body);

    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x26445f, roughness: 0.78 });
    this.cloakMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.95, 12, 1, true), cloakMat);
    this.cloakMesh.position.y = 0.65;
    this.cloakMesh.castShadow = true;
    this.playerGroup.add(this.cloakMesh);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.65 }),
    );
    head.position.y = 1.18;
    head.castShadow = true;
    this.playerGroup.add(head);

    // Nón lá (Vietnamese conical hat) + woven golden rim
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xe6c385, roughness: 0.75 });
    const nonLa = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.42, 20), hatMat);
    nonLa.position.y = 1.46;
    nonLa.castShadow = true;
    this.hatGroup.add(nonLa);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.71, 0.028, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xc99345, roughness: 0.6 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.26;
    this.hatGroup.add(rim);

    // Dangling small lantern hanging from front rim of nón lá
    this.danglingLantern.position.set(0, 1.28, 0.64);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6),
      new THREE.MeshBasicMaterial({ color: 0x8f6b40 }),
    );
    cord.position.y = -0.13;
    this.danglingLantern.add(cord);

    const miniLamp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd275 }),
    );
    miniLamp.position.y = -0.3;
    this.danglingLantern.add(miniLamp);

    this.playerLight = new THREE.PointLight(0xffb854, 4.2, 14, 1.6);
    this.playerLight.position.y = -0.3;
    this.danglingLantern.add(this.playerLight);

    this.hatGroup.add(this.danglingLantern);
    this.playerGroup.add(this.hatGroup);

    // Orbiting carried firefly satellites around Mây (max carry_capacity)
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), this.moteMat);
      orb.visible = false;
      this.playerGroup.add(orb);
      this.carriedOrbs.push(orb);
    }

    this.scene.add(this.playerGroup);
  }

  private createLanternVisual(id: string): LanternVisual {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b3d54, roughness: 0.85 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x38241d, roughness: 0.82 });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 0.55, 8), stoneMat);
    plinth.position.y = 0.275;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.0, 8), woodMat);
    pillar.position.y = 1.9;
    pillar.castShadow = true;
    group.add(pillar);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x5c537a,
      emissive: 0x2d234a,
      emissiveIntensity: 0.4,
      roughness: 0.35,
    });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.52, 1.2, 6), coreMat);
    core.position.y = 3.7;
    group.add(core);

    // Pagoda curved roof eaves
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.72, 6), woodMat);
    roof.position.y = 4.6;
    roof.castShadow = true;
    group.add(roof);

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffc666, metalness: 0.5, roughness: 0.3 }),
    );
    finial.position.y = 5.05;
    group.add(finial);

    const light = new THREE.PointLight(0xffa942, 0, 22, 1.5);
    light.position.y = 3.7;
    group.add(light);

    // Heavenward warm light pillar (visible once lit)
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.9, 28, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc46b,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beacon.position.y = 14.2;
    beacon.visible = false;
    group.add(beacon);

    // Golden sanctuary ground ring matching exact safe_radius
    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.16, TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffc564,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.06;
    safeRing.visible = false;
    group.add(safeRing);

    const depositPips: THREE.Mesh[] = [];
    for (let i = 0; i < TUNING.lantern_cost; i++) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), this.moteMat);
      pip.visible = false;
      group.add(pip);
      depositPips.push(pip);
    }

    this.scene.add(group);
    const vis: LanternVisual = { group, coreMat, light, beacon, safeRing, depositPips };
    this.lanternMap.set(id, vis);
    return vis;
  }

  private createShadeVisual(id: string): ShadeVisual {
    const group = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x160b24,
      emissive: 0x451878,
      emissiveIntensity: 0.7,
      roughness: 0.5,
    });
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), coreMat);
    body.castShadow = true;
    group.add(body);

    // Piercing glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe6b8ff });
    for (const ex of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(ex, 0.15, 0.56);
      group.add(eye);
    }

    // Writhing ink-droplet tendrils
    const tendrils: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), coreMat);
      group.add(t);
      tendrils.push(t);
    }

    // Golden stun halo overhead
    const stunRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.055, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd86b }),
    );
    stunRing.rotation.x = Math.PI / 2;
    stunRing.position.y = 1.05;
    stunRing.visible = false;
    group.add(stunRing);

    this.scene.add(group);
    const vis: ShadeVisual = { group, coreMat, tendrils, stunRing };
    this.shadeMap.set(id, vis);
    return vis;
  }

  sync(sim: Simulation, elapsed: number): void {
    // 1. Player Mây
    const [px, py, pz] = sim.player.pos;
    const dx = px - this.prevPlayerX;
    const dz = pz - this.prevPlayerZ;
    const speed = Math.hypot(dx, dz);
    if (speed > 0.002) {
      this.facingYaw = Math.atan2(dx, dz);
    }
    this.prevPlayerX = px;
    this.prevPlayerZ = pz;

    const bob = speed > 0.005 && py <= 0.01 ? Math.abs(Math.sin(elapsed * 11)) * 0.08 : 0;
    this.playerGroup.position.set(px, py + bob, pz);
    this.playerGroup.rotation.y = this.facingYaw;
    this.cloakMesh.rotation.x = -Math.min(0.32, speed * 2.2);
    this.danglingLantern.rotation.x = -Math.min(0.45, speed * 3.0) + Math.sin(elapsed * 3.5) * 0.06;
    this.danglingLantern.rotation.z = Math.cos(elapsed * 2.8) * 0.07;

    // Invulnerability blink feedback
    this.playerGroup.visible = sim.player.invulnTimer <= 0 || Math.floor(elapsed * 16) % 2 === 0;
    this.playerLight.intensity = 3.8 + sim.player.carried * 0.7 + Math.sin(elapsed * 6) * 0.25;

    for (let i = 0; i < this.carriedOrbs.length; i++) {
      const orb = this.carriedOrbs[i];
      orb.visible = i < sim.player.carried;
      if (orb.visible) {
        const a = elapsed * 2.6 + (i * Math.PI * 2) / Math.max(1, sim.player.carried);
        orb.position.set(Math.cos(a) * 0.85, 1.05 + Math.sin(elapsed * 4 + i) * 0.16, Math.sin(a) * 0.85);
      }
    }

    // 2. Lanterns
    for (const l of sim.lanterns) {
      const vis = this.lanternMap.get(l.id) ?? this.createLanternVisual(l.id);
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      if (l.lit) {
        vis.coreMat.color.setHex(0xffd275);
        vis.coreMat.emissive.setHex(0xff9b2a);
        vis.coreMat.emissiveIntensity = 1.9 + Math.sin(elapsed * 4 + l.pos[0]) * 0.18;
        vis.light.intensity = 9.5 + Math.sin(elapsed * 4.5 + l.pos[2]) * 0.6;
        vis.beacon.visible = true;
        vis.safeRing.visible = true;
      } else {
        vis.coreMat.color.setHex(0x5c537a);
        vis.coreMat.emissive.setHex(l.deposited > 0 ? 0xa36420 : 0x2d234a);
        vis.coreMat.emissiveIntensity = 0.4 + l.deposited * 0.45;
        vis.light.intensity = l.deposited * 1.4;
        vis.beacon.visible = false;
        vis.safeRing.visible = false;
      }
      for (let i = 0; i < vis.depositPips.length; i++) {
        const pip = vis.depositPips[i];
        pip.visible = !l.lit && i < l.deposited;
        if (pip.visible) {
          const a = elapsed * 2.2 + (i * Math.PI * 2) / TUNING.lantern_cost;
          pip.position.set(Math.cos(a) * 1.15, 2.35 + Math.sin(elapsed * 3 + i) * 0.2, Math.sin(a) * 1.15);
        }
      }
    }

    // 3. Shades
    const activeShadeIds = new Set(sim.shades.map((s) => s.id));
    for (const [id, vis] of this.shadeMap) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeMap.delete(id);
      }
    }
    for (const s of sim.shades) {
      const vis = this.shadeMap.get(s.id) ?? this.createShadeVisual(s.id);
      const jitterX = s.state === 'stunned' ? Math.sin(elapsed * 42) * 0.12 : 0;
      vis.group.position.set(
        s.pos[0] + jitterX,
        Math.max(0.8, s.pos[1]) + Math.sin(elapsed * 3.4 + s.pos[0]) * 0.16,
        s.pos[2],
      );
      vis.group.rotation.y = Math.atan2(px - s.pos[0], pz - s.pos[2]);
      vis.stunRing.visible = s.state === 'stunned';
      if (s.state === 'stunned') {
        vis.stunRing.rotation.z = elapsed * 4;
        vis.coreMat.emissive.setHex(0xc49a3a);
        vis.coreMat.emissiveIntensity = 1.2;
      } else {
        vis.coreMat.emissive.setHex(s.state === 'flee' ? 0x8a30b8 : 0x451878);
        vis.coreMat.emissiveIntensity = 0.75;
      }
      vis.tendrils.forEach((t, idx) => {
        const a = elapsed * 2.6 + (idx * Math.PI) / 2;
        t.position.set(Math.cos(a) * 0.58, -0.35 + Math.sin(elapsed * 5 + idx) * 0.18, Math.sin(a) * 0.58);
      });
    }

    // 4. Motes (floating visually above ground point [x, 0, z])
    const activeMoteIds = new Set(sim.motes.map((m) => m.id));
    for (const [id, mesh] of this.moteMap) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(mesh);
        this.moteMap.delete(id);
      }
    }
    for (const m of sim.motes) {
      let g = this.moteMap.get(m.id);
      if (!g) {
        g = new THREE.Group();
        g.add(new THREE.Mesh(this.moteGeo, this.moteMat));
        g.add(new THREE.Mesh(this.moteHaloGeo, this.moteHaloMat));
        this.scene.add(g);
        this.moteMap.set(m.id, g);
      }
      g.position.set(m.pos[0], 0.95 + Math.sin(elapsed * 3.2 + m.pos[0] * 0.7 + m.pos[2] * 0.5) * 0.24, m.pos[2]);
    }
  }
}
