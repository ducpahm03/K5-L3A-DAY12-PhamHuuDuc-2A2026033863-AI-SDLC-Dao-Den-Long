import { round3 } from './rng.js';
import { SHADE_SPEED_NIGHT3, TUNING } from './tuning.js';
import type { NightNumber, Vec2, Vec3 } from './types.js';

export interface JumpPadDef {
  pos: Vec3;
  radius: number;
  vy: number;
  vh: number;
  dirXZ: Vec2; // Unit XZ direction
}

export interface MapConfig {
  night: NightNumber;
  name: string;
  introLine: string;
  durationS: number;
  spawnPos: Vec3;
  lanterns: Array<{ id: string; pos: Vec3 }>;
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeIntervalTicks: number;
  shadeMaxCount: number;
  shadeSpeed: number;
  driftersEnabled: boolean;
  windEnabledByDefault: boolean;
  charms: Array<{ id: string; pos: Vec3 }>;
  jumpPads: JumpPadDef[];
}

function ringPoints(
  cx: number,
  cz: number,
  y: number,
  radius: number,
  anglesDeg: number[],
): Vec3[] {
  return anglesDeg.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [round3(cx + Math.cos(rad) * radius), y, round3(cz + Math.sin(rad) * radius)];
  });
}

function stepAngles(start: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function unitXZ(dx: number, dz: number): Vec2 {
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

const NIGHT1_MAP: MapConfig = {
  night: 1,
  name: 'Đêm 1 — Đảo Bến',
  introLine: 'Ông Đăng dặn: "Sương mực đã phủ kín Đảo Bến. Mây hãy gom đom đóm, thắp lại 5 Đèn Lồng Lớn trước khi bình minh tới!"',
  durationS: TUNING.night1_duration_s,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  motePoints: [
    ...ringPoints(0, 0, 0, 12, stepAngles(0, 45, 8)),
    ...ringPoints(0, 0, 0, 33, stepAngles(0, 22.5, 16)),
  ],
  shadePoints: ringPoints(0, 0, 0, 37, stepAngles(15, 30, 12)),
  shadeIntervalTicks: 480, // 8s
  shadeMaxCount: 6,
  shadeSpeed: TUNING.shade_speed,
  driftersEnabled: false,
  windEnabledByDefault: false,
  charms: [],
  jumpPads: [],
};

const NIGHT2_MAP: MapConfig = {
  night: 2,
  name: 'Đêm 2 — Đảo Cau',
  introLine: 'Ông Đăng dặn: "Đảo Cau có hai bờ nối bằng cầu tre hẹp. Coi chừng Gió Lạc cướp đom đóm, hãy tận dụng bục nhảy và Bùa Gió!"',
  durationS: TUNING.night2_duration_s,
  spawnPos: [0, 0, 0],
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  motePoints: [
    ...ringPoints(0, 0, 0, 10, [0, 90, 180, 270]),
    ...ringPoints(0, 0, 0, 22, stepAngles(0, 45, 8)),
    ...ringPoints(70, 0, 0, 10, [0, 90, 180, 270]),
    ...ringPoints(70, 0, 0, 22, stepAngles(0, 45, 8)),
  ],
  shadePoints: [
    ...ringPoints(0, 0, 0, 26, stepAngles(22.5, 45, 8)),
    ...ringPoints(70, 0, 0, 26, stepAngles(22.5, 45, 8)),
  ],
  shadeIntervalTicks: 420, // 7s
  shadeMaxCount: 8,
  shadeSpeed: TUNING.shade_speed,
  driftersEnabled: true,
  windEnabledByDefault: false,
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  jumpPads: [
    { pos: [20, 0, 18], radius: 1, vy: 14, vh: 24, dirXZ: unitXZ(70 - 20, 0 - 18) },
    { pos: [50, 0, -18], radius: 1, vy: 14, vh: 24, dirXZ: unitXZ(0 - 50, 0 - -18) },
  ],
};

const NIGHT3_MAP: MapConfig = {
  night: 3,
  name: 'Đêm 3 — Đảo Chuông',
  introLine: 'Ông Đăng dặn: "Đảo Chuông ba tầng lộng gió là thử thách cuối cùng. Lên dốc, phóng lên đỉnh tháp chuông và đón bình minh về!"',
  durationS: TUNING.night3_duration_s,
  spawnPos: [0, 0, -15],
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  motePoints: [
    ...ringPoints(0, 0, 0, 34, stepAngles(0, 20, 18)),
    ...ringPoints(0, 0, 3, 18, stepAngles(20, 20, 8)),
    ...ringPoints(0, 0, 6, 5, [45, 135, 225, 315]),
  ],
  shadePoints: ringPoints(0, 0, 0, 43, stepAngles(0, 22.5, 16)),
  shadeIntervalTicks: 360, // 6s
  shadeMaxCount: 10,
  shadeSpeed: SHADE_SPEED_NIGHT3,
  driftersEnabled: true,
  windEnabledByDefault: true,
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  jumpPads: [{ pos: [0, 3, 13], radius: 1, vy: 12, vh: 8, dirXZ: [0, -1] }],
};

export function getMapConfig(night: NightNumber): MapConfig {
  if (night === 1) return NIGHT1_MAP;
  if (night === 2) return NIGHT2_MAP;
  return NIGHT3_MAP;
}

const RAMP_ANGLES = [(30 * Math.PI) / 180, (150 * Math.PI) / 180];

/** Check if (x, z) is on one of Night 3's two radial ramps (r in [24, 30], width 3m). */
function getNight3RampY(x: number, z: number): number | null {
  for (const a of RAMP_ANGLES) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const proj = x * ca + z * sa;
    const perp = Math.abs(-x * sa + z * ca);
    if (perp <= 1.5 && proj >= 24 && proj <= 30) {
      return (3 * (30 - proj)) / 6;
    }
  }
  return null;
}

/** Returns ground elevation Y at (x, z), or null if over the cloud sea (void). */
export function getSurfaceY(night: NightNumber, x: number, z: number): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? 0 : null;
  }
  if (night === 2) {
    if (Math.hypot(x, z) <= 28) return 0;
    if (Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  }
  // Night 3 — Đảo Chuông
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 8) return 6;
  if (r >= 12 && r <= 24 && z > 0) return 3;
  const rampY = getNight3RampY(x, z);
  if (rampY !== null) return rampY;
  return 0;
}

/** Returns true if (x, y, z) hits Night 3's central unclimbable bell tower (r < 2, y < 14). */
export function isBlockedByObstacle(night: NightNumber, x: number, y: number, z: number): boolean {
  if (night === 3 && y < 14 && Math.hypot(x, z) < 2) {
    return true;
  }
  return false;
}
