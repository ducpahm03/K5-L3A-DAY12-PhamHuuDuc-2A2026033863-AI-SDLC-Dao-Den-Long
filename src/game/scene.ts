import * as THREE from 'three';
import { ISLAND_RADIUS, getDefaultNight1Lanterns } from '../core/tuning.js';

interface CloudPuff {
  mesh: THREE.Mesh;
  angle: number;
  radius: number;
  speed: number;
  baseY: number;
}

interface SkyLantern {
  mesh: THREE.Mesh;
  speed: number;
  baseX: number;
  baseZ: number;
  phase: number;
}

export class WorldScene {
  public readonly scene = new THREE.Scene();
  private readonly fog: THREE.FogExp2;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly moonLight: THREE.DirectionalLight;
  private readonly skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uBottomColor: { value: THREE.Color };
  };
  private readonly clouds: CloudPuff[] = [];
  private readonly skyLanterns: SkyLantern[] = [];
  private readonly stars: THREE.Points;
  private currentProgress = 0;

  constructor() {
    this.fog = new THREE.FogExp2(0x110c22, 0.017);
    this.scene.fog = this.fog;

    // Gradient sky dome
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x090818) },
      uHorizonColor: { value: new THREE.Color(0x1e1438) },
      uBottomColor: { value: new THREE.Color(0x141028) },
    };
    const skyGeo = new THREE.SphereGeometry(220, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = h >= 0.0
            ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.65))
            : mix(uHorizonColor, uBottomColor, pow(clamp(-h, 0.0, 1.0), 0.55));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Lighting
    this.hemiLight = new THREE.HemisphereLight(0x7c78c8, 0x1a152e, 0.62);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.85);
    this.moonLight.position.set(-45, 65, -35);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 10;
    this.moonLight.shadow.camera.far = 180;
    const d = 42;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.scene.add(this.moonLight);

    this.stars = this.buildStarfield();
    this.buildMoon();
    this.buildIsland();
    this.buildWoodenPier();
    this.buildTreesAndProps();
    this.buildCloudSea();
    this.buildDistantSkyLanterns();
  }

  private buildStarfield(): THREE.Points {
    const count = 550;
    const pos = new Float32Array(count * 3);
    let seed = 104729;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(0.15 + rand() * 0.85);
      const r = 175 + rand() * 20;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xfff0d4, size: 1.15, transparent: true, opacity: 0.85 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    return pts;
  }

  private buildMoon(): void {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    );
    moon.position.set(-72, 82, -88);
    this.scene.add(moon);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(12, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.14, side: THREE.BackSide }),
    );
    halo.position.copy(moon.position);
    this.scene.add(halo);
  }

  private buildIsland(): void {
    // Top moss-earth disk (surface at Y = 0)
    const topGeo = new THREE.CylinderGeometry(ISLAND_RADIUS + 0.6, ISLAND_RADIUS + 1.4, 2.2, 64);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1d2938, roughness: 0.92, metalness: 0.04 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = -1.1;
    top.receiveShadow = true;
    this.scene.add(top);

    // Tapered floating rock underside descending into cloud sea
    const underGeo = new THREE.ConeGeometry(ISLAND_RADIUS + 1.1, 22, 24);
    const underMat = new THREE.MeshStandardMaterial({ color: 0x151324, roughness: 0.95, flatShading: true });
    const under = new THREE.Mesh(underGeo, underMat);
    under.rotation.x = Math.PI;
    under.position.y = -13.2;
    this.scene.add(under);

    // Central stone compass dais at (0, 0, 0)
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.3, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0x3b3d54, roughness: 0.85 }),
    );
    dais.position.y = 0.02;
    dais.receiveShadow = true;
    this.scene.add(dais);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 2.95, 32),
      new THREE.MeshBasicMaterial({ color: 0xffbe62, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.scene.add(ring);

    // Flagstone paths radiating toward all 5 default lanterns
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x33374d, roughness: 0.88 });
    for (const l of getDefaultNight1Lanterns()) {
      const len = Math.hypot(l.pos[0], l.pos[2]);
      const angle = Math.atan2(l.pos[0], l.pos[2]);
      const steps = 8;
      for (let s = 1; s < steps; s++) {
        const dist = 4.5 + ((len - 6.5) * s) / steps;
        const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.08, 7), stoneMat);
        slab.position.set(Math.sin(angle) * dist, 0.02, Math.cos(angle) * dist);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }

    // Perimeter low stone posts marking the 35m circular cloud boundary
    const postCount = 32;
    const postGeo = new THREE.CylinderGeometry(0.28, 0.38, 1.0, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2f3048, roughness: 0.88 });
    const glowCapGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const glowCapMat = new THREE.MeshBasicMaterial({ color: 0x8b7ec8 });
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) > 0.9) continue; // Opening for wooden pier
      const x = Math.sin(a) * (ISLAND_RADIUS + 0.1);
      const z = Math.cos(a) * (ISLAND_RADIUS + 0.1);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0.45, z);
      post.castShadow = true;
      this.scene.add(post);

      if (i % 2 === 0) {
        const cap = new THREE.Mesh(glowCapGeo, glowCapMat);
        cap.position.set(x, 1.05, z);
        this.scene.add(cap);
      }
    }
  }

  private buildWoodenPier(): void {
    // Iconic "Đảo Bến" wooden pier extending off +Z rim into sea of clouds
    const pierGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4d3527, roughness: 0.88 });
    for (let i = 0; i < 9; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 0.85), woodMat);
      plank.position.set(0, 0.04, ISLAND_RADIUS + 0.4 + i * 0.98);
      plank.receiveShadow = true;
      pierGroup.add(plank);
    }
    for (const side of [-1.75, 1.75]) {
      for (const zOff of [1.2, 4.8, 8.2]) {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 8), woodMat);
        bollard.position.set(side, 0.45, ISLAND_RADIUS + zOff);
        pierGroup.add(bollard);
      }
    }
    this.scene.add(pierGroup);
  }

  private buildTreesAndProps(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2c2026, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x162838, roughness: 0.88, flatShading: true });
    const shroomMat = new THREE.MeshBasicMaterial({ color: 0xffc872 });

    // Place stylized fairy pines between lantern sectors near the rim
    for (let i = 0; i < 15; i++) {
      const angle = ((i + 0.5) * Math.PI * 2) / 15;
      const r = i % 2 === 0 ? 29.5 : 31.8;
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;
      const scale = 0.85 + (i % 3) * 0.28;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.36 * scale, 2.2 * scale, 6), trunkMat);
      trunk.position.y = 1.1 * scale;
      trunk.castShadow = true;
      tree.add(trunk);

      const crown1 = new THREE.Mesh(new THREE.ConeGeometry(1.7 * scale, 3.0 * scale, 7), leafMat);
      crown1.position.y = 2.8 * scale;
      crown1.castShadow = true;
      tree.add(crown1);

      const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.25 * scale, 2.5 * scale, 7), leafMat);
      crown2.position.y = 4.4 * scale;
      crown2.castShadow = true;
      tree.add(crown2);

      tree.position.set(x, 0, z);
      this.scene.add(tree);

      if (i % 3 === 0) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), shroomMat);
        cap.scale.set(1.2, 0.65, 1.2);
        cap.position.set(x - Math.sin(angle) * 1.4, 0.2, z - Math.cos(angle) * 1.4);
        this.scene.add(cap);
      }
    }
  }

  private buildCloudSea(): void {
    const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x2c284a,
      roughness: 1,
      transparent: true,
      opacity: 0.55,
    });
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2 + (i % 5) * 0.2;
      const radius = 38 + (i % 7) * 14;
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      const sx = 8 + (i % 4) * 5;
      mesh.scale.set(sx, 2.2 + (i % 3) * 0.9, sx * 0.72);
      const baseY = -4.5 - (i % 4) * 2.2;
      mesh.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      this.scene.add(mesh);
      this.clouds.push({ mesh, angle, radius, speed: 0.012 + (i % 5) * 0.004, baseY });
    }
  }

  private buildDistantSkyLanterns(): void {
    const geo = new THREE.CylinderGeometry(0.35, 0.22, 0.6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb858 });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = 52 + (i % 6) * 14;
      const mesh = new THREE.Mesh(geo, mat);
      const baseX = Math.cos(a) * r;
      const baseZ = Math.sin(a) * r;
      mesh.position.set(baseX, (i * 4.7) % 48, baseZ);
      this.scene.add(mesh);
      this.skyLanterns.push({ mesh, speed: 0.55 + (i % 4) * 0.2, baseX, baseZ, phase: i * 1.1 });
    }
  }

  update(dt: number, elapsed: number, litFraction: number): void {
    // Smooth atmospheric transition from midnight violet-black (0/5) to warm golden fairy dawn (5/5)
    this.currentProgress += (litFraction - this.currentProgress) * Math.min(1, dt * 1.8);
    const p = this.currentProgress;

    this.skyUniforms.uTopColor.value.setRGB(0.035 + p * 0.07, 0.032 + p * 0.095, 0.095 + p * 0.17);
    this.skyUniforms.uHorizonColor.value.setRGB(0.11 + p * 0.52, 0.075 + p * 0.3, 0.21 + p * 0.08);
    this.skyUniforms.uBottomColor.value.setRGB(0.08 + p * 0.22, 0.06 + p * 0.14, 0.15 + p * 0.09);

    this.fog.color.copy(this.skyUniforms.uHorizonColor.value);
    this.fog.density = 0.0175 - p * 0.008;

    this.hemiLight.intensity = 0.62 + p * 0.68;
    this.hemiLight.color.setRGB(0.48 + p * 0.48, 0.47 + p * 0.36, 0.78 - p * 0.18);
    this.moonLight.intensity = 0.85 + p * 0.55;
    this.moonLight.color.setRGB(0.78 + p * 0.22, 0.83 + p * 0.09, 1.0 - p * 0.28);

    this.stars.rotation.y = elapsed * 0.006;

    for (const c of this.clouds) {
      c.angle += c.speed * dt;
      c.mesh.position.set(
        Math.cos(c.angle) * c.radius,
        c.baseY + Math.sin(elapsed * 0.4 + c.angle) * 0.55,
        Math.sin(c.angle) * c.radius,
      );
    }

    for (const sl of this.skyLanterns) {
      sl.mesh.position.y += sl.speed * dt;
      if (sl.mesh.position.y > 55) sl.mesh.position.y = -3;
      sl.mesh.position.x = sl.baseX + Math.sin(elapsed * 0.5 + sl.phase) * 1.5;
    }
  }
}
