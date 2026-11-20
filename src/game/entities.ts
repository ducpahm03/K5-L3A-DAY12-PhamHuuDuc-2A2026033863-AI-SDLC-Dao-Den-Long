import * as THREE from 'three';
import type { Simulation } from '../core/simulation.js';
import { FUEL_LOW_THRESHOLD_UNITS, FUEL_MAX_UNITS, FUEL_UNIT_SCALE, TUNING } from '../core/tuning.js';
import { PALETTE } from './scene.js';

interface LanternVisual {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  tearMesh: THREE.Mesh;
  fuelBarGroup: THREE.Group;
  fuelFill: THREE.Mesh;
  fuelMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  beacon: THREE.Mesh;
  safeRing: THREE.Mesh;
}

interface ShadeVisual {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  rimMat: THREE.MeshBasicMaterial;
  stunRing: THREE.Mesh;
}

export class EntityRenderer {
  private readonly scene: THREE.Scene;
  public readonly playerGroup = new THREE.Group();
  private readonly scarfMesh: THREE.Mesh;
  private readonly danglingLantern = new THREE.Group();
  private readonly charmAura: THREE.Mesh;
  private readonly carriedOrbs: THREE.Mesh[] = [];
  private colorblind = false;

  private readonly lanternMap = new Map<string, LanternVisual>();
  private readonly shadeMap = new Map<string, ShadeVisual>();
  private readonly moteMap = new Map<string, THREE.Group>();
  private readonly drifterMap = new Map<string, THREE.Group>();
  private readonly charmMap = new Map<string, THREE.Group>();

  private readonly moteGeo = new THREE.SphereGeometry(0.22, 10, 10);
  private readonly moteMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
  private readonly haloGeo = new THREE.SphereGeometry(0.42, 10, 10);
  private readonly haloMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.34 });

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.38, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayRobe, roughness: 0.72 }),
    );
    body.position.y = 0.52;
    body.castShadow = true;
    this.playerGroup.add(body);

    const scarfMat = new THREE.MeshStandardMaterial({ color: PALETTE.mayScarf, roughness: 0.65 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 16), scarfMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.95;
    this.playerGroup.add(collar);

    this.scarfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.65), scarfMat);
    this.scarfMesh.position.set(0, 0.9, -0.4);
    this.playerGroup.add(this.scarfMesh);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.65 }),
    );
    head.position.y = 1.18;
    this.playerGroup.add(head);

    const nonLa = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, 0.42, 18),
      new THREE.MeshStandardMaterial({ color: 0xe6c385, roughness: 0.75 }),
    );
    nonLa.position.y = 1.46;
    nonLa.castShadow = true;
    this.playerGroup.add(nonLa);

    this.danglingLantern.position.set(0, 1.28, 0.64);
    const miniLamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 1), new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore }));
    miniLamp.position.y = -0.26;
    this.danglingLantern.add(miniLamp);
    const pLight = new THREE.PointLight(PALETTE.lanternLit, 3.8, 14, 1.6);
    pLight.position.y = -0.26;
    this.danglingLantern.add(pLight);
    this.playerGroup.add(this.danglingLantern);

    this.charmAura = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.95, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.mayScarf, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    this.charmAura.rotation.x = -Math.PI / 2;
    this.charmAura.position.y = 0.08;
    this.charmAura.visible = false;
    this.playerGroup.add(this.charmAura);

    for (let i = 0; i < TUNING.capacity_max; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.moteMat);
      orb.visible = false;
      this.playerGroup.add(orb);
      this.carriedOrbs.push(orb);
    }

    this.scene.add(this.playerGroup);
  }

  setColorblind(cb: boolean): void {
    this.colorblind = cb;
  }

  clearAllDynamic(): void {
    for (const v of this.lanternMap.values()) this.scene.remove(v.group);
    this.lanternMap.clear();
    for (const v of this.shadeMap.values()) this.scene.remove(v.group);
    this.shadeMap.clear();
    for (const v of this.moteMap.values()) this.scene.remove(v);
    this.moteMap.clear();
    for (const v of this.drifterMap.values()) this.scene.remove(v);
    this.drifterMap.clear();
    for (const v of this.charmMap.values()) this.scene.remove(v);
    this.charmMap.clear();
  }

  private createLantern(id: string): LanternVisual {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 0.5, 8), new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff }));
    plinth.position.y = 0.25;
    group.add(plinth);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.0, 8), woodMat);
    pillar.position.y = 1.9;
    group.add(pillar);

    const coreMat = new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, emissive: 0x222536, emissiveIntensity: 0.35 });
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.52, 1.2, 6), coreMat);
    coreMesh.position.y = 3.7;
    group.add(coreMesh);

    // Tear mark on unlit lantern paper (non-color distinction required by Ticket-03 Section 6)
    const tearMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.78, 1.22),
      new THREE.MeshBasicMaterial({ color: 0x120a1a }),
    );
    tearMesh.position.y = 3.7;
    tearMesh.rotation.z = 0.28;
    group.add(tearMesh);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.22, 0.72, 6), woodMat);
    roof.position.y = 4.6;
    group.add(roof);

    // 3D Fuel Bar above lantern
    const fuelBarGroup = new THREE.Group();
    fuelBarGroup.position.y = 5.45;
    const bgBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0x151828 }));
    fuelBarGroup.add(bgBar);
    const fuelMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold });
    const fuelFill = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.12, 0.1), fuelMat);
    fuelBarGroup.add(fuelFill);
    fuelBarGroup.visible = false;
    group.add(fuelBarGroup);

    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 22, 1.5);
    light.position.y = 3.7;
    group.add(light);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.8, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    beacon.position.y = 13.2;
    beacon.visible = false;
    group.add(beacon);

    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 44),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.06;
    safeRing.visible = false;
    group.add(safeRing);

    this.scene.add(group);
    const vis: LanternVisual = { group, coreMesh, coreMat, tearMesh, fuelBarGroup, fuelFill, fuelMat, light, beacon, safeRing };
    this.lanternMap.set(id, vis);
    return vis;
  }

  private createShade(id: string): ShadeVisual {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.shadeBody, emissive: PALETTE.shadeRim, emissiveIntensity: 0.45 });
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), bodyMat));

    const rimMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    for (const ex of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), rimMat);
      eye.position.set(ex, 0.15, 0.56);
      group.add(eye);
    }

    const stunRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 18), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    stunRing.rotation.x = Math.PI / 2;
    stunRing.position.y = 1.05;
    stunRing.visible = false;
    group.add(stunRing);

    this.scene.add(group);
    const vis: ShadeVisual = { group, bodyMat, rimMat, stunRing };
    this.shadeMap.set(id, vis);
    return vis;
  }

  private createDrifter(id: string): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.drifter, emissive: 0x526a82, emissiveIntensity: 0.55, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 1.9), mat));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 6), mat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -1.35;
    g.add(tail);
    this.scene.add(g);
    this.drifterMap.set(id, g);
    return g;
  }

  private createCharm(id: string): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: PALETTE.mayScarf, emissive: 0x6a0818 })));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.98, 0.04), new THREE.MeshBasicMaterial({ color: PALETTE.gold })));
    this.scene.add(g);
    this.charmMap.set(id, g);
    return g;
  }

  sync(sim: Simulation, elapsed: number): void {
    const [px, py, pz] = sim.player.pos;
    this.playerGroup.position.set(px, py, pz);
    this.playerGroup.rotation.y = Math.atan2(sim.player.facing[0], sim.player.facing[1]);
    this.playerGroup.visible =
      sim.player.respawnWaitTicks === 0 && (sim.player.invulnTicks === 0 || Math.floor(elapsed * 16) % 2 === 0);

    const spd = Math.hypot(sim.player.vel[0], sim.player.vel[2]);
    this.scarfMesh.rotation.x = Math.sin(elapsed * 14) * 0.14 + Math.min(0.45, spd * 0.04);
    this.danglingLantern.rotation.x = -Math.min(0.45, spd * 0.04) + Math.sin(elapsed * 3.5) * 0.06;
    this.charmAura.visible = sim.player.charmTicks > 0;
    if (this.charmAura.visible) this.charmAura.rotation.z = elapsed * 3;

    for (let i = 0; i < this.carriedOrbs.length; i++) {
      const o = this.carriedOrbs[i];
      o.visible = i < sim.player.carried;
      if (o.visible) {
        const a = elapsed * 2.5 + (i * Math.PI * 2) / Math.max(1, sim.player.carried);
        o.position.set(Math.cos(a) * 0.9, 1.05 + Math.sin(elapsed * 4 + i) * 0.14, Math.sin(a) * 0.9);
      }
    }

    // 1 Hz slow blink phase for low fuel (< 30)
    const blinkOn = Math.sin(elapsed * Math.PI * 2) >= -0.2;

    for (const l of sim.lanterns) {
      const vis = this.lanternMap.get(l.id) ?? this.createLantern(l.id);
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      if (l.lit) {
        const lowFuel = l.fuelUnits < FUEL_LOW_THRESHOLD_UNITS;
        const frac = Math.max(0.02, l.fuelUnits / FUEL_MAX_UNITS);
        vis.coreMesh.scale.set(1, 1, 1);
        vis.tearMesh.visible = false;
        vis.fuelBarGroup.visible = !lowFuel || blinkOn;
        vis.fuelFill.scale.x = frac;
        vis.fuelFill.position.x = -((1 - frac) * 1.36) / 2;
        vis.fuelMat.color.setHex(lowFuel ? (this.colorblind ? 0xffffff : 0xff5a5f) : PALETTE.gold);

        const dimFactor = lowFuel && !blinkOn ? 0.35 : 1.0;
        vis.coreMat.color.setHex(PALETTE.lanternCore);
        vis.coreMat.emissive.setHex(PALETTE.lanternLit);
        vis.coreMat.emissiveIntensity = 1.8 * dimFactor;
        vis.light.intensity = 9.0 * dimFactor;
        vis.beacon.visible = true;
        vis.safeRing.visible = !lowFuel; // Loses safe zone when fuel < 30
      } else {
        // Unlit lantern: squashed by 20% + visible tear mark
        vis.coreMesh.scale.set(1.06, 0.8, 1.06);
        vis.tearMesh.visible = true;
        vis.fuelBarGroup.visible = false;
        const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        vis.coreMat.color.setHex(PALETTE.lanternOff);
        vis.coreMat.emissive.setHex(l.deposited > 0 ? 0x8f5d1e : 0x1c2030);
        vis.coreMat.emissiveIntensity = 0.35 + (l.deposited / cost) * 0.9;
        vis.light.intensity = (l.deposited / cost) * 3.0;
        vis.beacon.visible = false;
        vis.safeRing.visible = false;
      }
    }

    const shadeRimHex = this.colorblind ? 0x00b3ff : PALETTE.shadeRim;
    const shadeIds = new Set(sim.shades.map((s) => s.id));
    for (const [id, v] of this.shadeMap) if (!shadeIds.has(id)) { this.scene.remove(v.group); this.shadeMap.delete(id); }
    for (const s of sim.shades) {
      const vis = this.shadeMap.get(s.id) ?? this.createShade(s.id);
      const scale = s.state === 'spawning' ? Math.max(0.25, 1 - s.stateTicksLeft / 60) : 1;
      vis.group.scale.setScalar(scale);
      vis.group.position.set(s.pos[0], s.pos[1] + Math.sin(elapsed * 3.5 + s.pos[0]) * 0.14, s.pos[2]);
      vis.group.rotation.y = Math.atan2(px - s.pos[0], pz - s.pos[2]);
      vis.stunRing.visible = s.state === 'stunned';
      vis.rimMat.color.setHex(shadeRimHex);
      if (s.state === 'stunned') {
        vis.bodyMat.color.setHex(PALETTE.shadeStun);
        vis.bodyMat.emissive.setHex(PALETTE.gold);
        vis.stunRing.rotation.z = elapsed * 4;
      } else if (s.state === 'drain') {
        vis.bodyMat.color.setHex(PALETTE.shadeBody);
        vis.bodyMat.emissive.setHex(PALETTE.lanternLit);
      } else {
        vis.bodyMat.color.setHex(PALETTE.shadeBody);
        vis.bodyMat.emissive.setHex(shadeRimHex);
      }
    }

    const moteIds = new Set(sim.motes.map((m) => m.id));
    for (const [id, g] of this.moteMap) if (!moteIds.has(id)) { this.scene.remove(g); this.moteMap.delete(id); }
    for (const m of sim.motes) {
      let g = this.moteMap.get(m.id);
      if (!g) {
        g = new THREE.Group();
        g.add(new THREE.Mesh(this.moteGeo, this.moteMat));
        g.add(new THREE.Mesh(this.haloGeo, this.haloMat));
        this.scene.add(g);
        this.moteMap.set(m.id, g);
      }
      g.visible = m.ttlTicks === null || m.ttlTicks > 180 || Math.floor(elapsed * 12) % 2 === 0;
      g.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(elapsed * 3.2 + m.pos[0]) * 0.22, m.pos[2]);
    }

    const drifterIds = new Set(sim.drifters.map((d) => d.id));
    for (const [id, g] of this.drifterMap) if (!drifterIds.has(id)) { this.scene.remove(g); this.drifterMap.delete(id); }
    for (const d of sim.drifters) {
      const g = this.drifterMap.get(d.id) ?? this.createDrifter(d.id);
      g.position.set(d.pos[0], d.pos[1] + Math.sin(elapsed * 6 + d.pos[2]) * 0.25, d.pos[2]);
      g.rotation.y = Math.atan2(px - d.pos[0], pz - d.pos[2]) + (d.state === 'flee' ? Math.PI : 0);
    }

    const charmIds = new Set(sim.charms.map((c) => c.id));
    for (const [id, g] of this.charmMap) if (!charmIds.has(id)) { this.scene.remove(g); this.charmMap.delete(id); }
    for (const c of sim.charms) {
      const g = this.charmMap.get(c.id) ?? this.createCharm(c.id);
      g.visible = c.available;
      g.position.set(c.pos[0], c.pos[1] + 1.15 + Math.sin(elapsed * 3.2) * 0.2, c.pos[2]);
      g.rotation.y = elapsed * 2.2;
    }
  }

  // Exported to prevent unused import warning
  public static readonly SCALE = FUEL_UNIT_SCALE;
}
