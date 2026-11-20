import { round3 } from './rng.js';
import type { Vec3 } from './types.js';

export const CONTRACT_VERSION = '1.0' as const;
export const TEAM_ID = '2A2026033863-pham-huu-duc' as const;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const ISLAND_RADIUS = 35;
export const LANTERN_RING_RADIUS = 22;
export const SHADE_DEFAULT_Y = 1.0;

export const JUMP_VELOCITY = 7.5;
export const GRAVITY = -20;

export const INITIAL_RANDOM_MOTES = 20;
export const MIN_RANDOM_MOTES = 18;
export const MOTE_SPAWN_INTERVAL_TICKS = 180;

export const INITIAL_RANDOM_SHADES = 1;
export const MAX_RANDOM_SHADES = 4;
export const SHADE_SPAWN_INTERVAL_TICKS = 900;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 7,
  night1_duration_s: 180,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 6,
  shade_speed: 3.6,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 200,
    per_stun: 25,
    per_second_left: 5,
    per_flame_left: 100,
  },
} as const;

export interface DefaultLanternDef {
  id: string;
  pos: Vec3;
}

export function getDefaultNight1Lanterns(): DefaultLanternDef[] {
  const count = TUNING.lantern_count_night1;
  const defs: DefaultLanternDef[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = round3(Math.sin(angle) * LANTERN_RING_RADIUS);
    const z = round3(Math.cos(angle) * LANTERN_RING_RADIUS);
    defs.push({ id: `L${i + 1}`, pos: [x, 0, z] });
  }
  return defs;
}
