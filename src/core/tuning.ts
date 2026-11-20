export const CONTRACT_VERSION = '1.2' as const;
export const TEAM_ID = '2A2026033863-pham-huu-duc' as const;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const JUMP_VELOCITY = 7.0;
export const GRAVITY = -20.0;
export const ACCEL_TIME_S = 0.08;

export const DASH_TICKS = 12;
export const DASH_COOLDOWN_TICKS = 90;
export const PULSE_COOLDOWN_TICKS = 180;
export const PULSE_STUN_TICKS = 120;
export const PULSE_PUSH_TICKS = 15;
export const PULSE_CENTER_Y_OFFSET = 0.8;

export const INVULN_TICKS = 90;
export const FALL_Y_THRESHOLD = -10;
export const FALL_RESPAWN_TICKS = 60;

export const MOTE_HEIGHT_TOLERANCE = 1.5;
export const INITIAL_RANDOM_MOTES = 20;
export const MAX_ACTIVE_MOTES = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;
export const DROPPED_MOTE_TTL_TICKS = 480;

export const SHADE_DEFAULT_Y = 1.0;
export const SHADE_DETECT_RADIUS = 12;
export const SHADE_LOSE_RADIUS = 18;
export const SHADE_HEIGHT_TOLERANCE = 1.5;
export const SHADE_SPAWN_FIRST_TICK = 300;
export const SHADE_SPAWNING_TICKS = 60;
export const SHADE_RECOIL_DIST = 2.0;
export const SHADE_RECOIL_TICKS = 60;
export const SAFE_PUSH_MAX_TICKS = 30;
export const SHADE_SPEED_NIGHT3 = 4.5;

export const DRIFTER_SPEED_IDLE = 2.0;
export const DRIFTER_SPEED_ACTIVE = 7.0;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_MIN_CARRIED = 5;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
export const DRIFTER_MAX_COUNT = 2;

export const CHARM_DURATION_TICKS = 600;
export const CHARM_SPEED = 7.2;
export const CHARM_RESPAWN_TICKS = 2700;

export const WIND_INTERVAL_TICKS = 1800;
export const WIND_DURATION_TICKS = 300;
export const WIND_WARN_TICKS = 120;
export const WIND_PUSH_SPEED = 2.0;

// Phase 3 Fuel constants in integer 1/60 units (6000 units == 100.0 fuel)
export const FUEL_UNIT_SCALE = 60;
export const FUEL_MAX_UNITS = 100 * FUEL_UNIT_SCALE; // 6000
export const FUEL_PER_MOTE_UNITS = 10 * FUEL_UNIT_SCALE; // 600
export const FUEL_LOW_THRESHOLD_UNITS = 30 * FUEL_UNIT_SCALE; // 1800
export const FUEL_DECAY_UNITS_PER_TICK = 1; // 1.0 fuel/s
export const FUEL_DRAIN_UNITS_PER_TICK = 5; // 5.0 fuel/s
export const SHADE_DRAIN_RADIUS = 2.0;
export const SHADE_DRAIN_CHASE_RADIUS = 6.0;
export const SCORE_RELIGHT = 40;
export const SCORE_PULSE_DRAIN = 15;
export const SCORE_DAWN_PER_LIT_LANTERN = 50;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  capacity_max: 20,
  lantern_cost: 10,
  relight_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 0,
    per_flame_left: 50,
  },
} as const;
