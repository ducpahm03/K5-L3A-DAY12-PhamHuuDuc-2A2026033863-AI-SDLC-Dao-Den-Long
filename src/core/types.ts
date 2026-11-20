export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
export type NightNumber = 1 | 2 | 3;

export type GameState = 'playing' | 'paused' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';
export type MoteKind = 'random' | 'dropped';

export interface InputFrame {
  tick: number;
  move?: Vec2;
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputsFile {
  frames: InputFrame[];
}

export interface ResolvedInput {
  move: Vec2;
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
  successful_lights?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeState;
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: Exclude<DrifterState, 'removed'>;
  stolen?: number;
  state_ticks_left?: number;
}

export interface ScenarioCharm {
  id?: string;
  pos: Vec3;
  available?: boolean;
  respawn_ticks?: number;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3; kind?: MoteKind; ttl_ticks?: number };

export interface ScenarioSpec {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: Vec2;
  flames: number;
  carried: number;
  capacity: number;
  successfulLights: number;
  invulnTicks: number;
  dashCdTicks: number;
  dashActiveTicks: number;
  dashDir: Vec2;
  pulseCdTicks: number;
  charmTicks: number;
  respawnWaitTicks: number;
  launchActive: boolean;
}

export interface LanternEntity {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  fuelUnits: number; // Integer 1/60 units (6000 == 100.0 fuel)
  everLit: boolean;
  relitCount: number;
}

export interface ShadeEntity {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stateTicksLeft: number;
  pushTicksLeft: number;
  pushDir: Vec2;
  recoilDir: Vec2;
  safePushTicks: number;
  safePushSource: Vec2 | null;
  targetLanternId: string | null;
  drainTicks: number;
  spawnTick: number;
}

export interface DrifterEntity {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  hasStolen: boolean;
  stateTicksLeft: number;
  idleAngle: number;
  spawnTick: number;
}

export interface CharmEntity {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface MoteEntity {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  ttlTicks: number | null;
  pickupReadyTick: number;
}

export interface WindState {
  active: boolean;
  warning: boolean;
  dirDeg: number;
  ticksLeft: number;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: NightNumber;
  state: GameState;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: Exclude<DrifterState, 'removed'>;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    pos: Vec3;
    available: boolean;
    respawn_s: number;
  }>;
}

export type EventName =
  | 'night_start'
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'refuel'
  | 'lantern_out'
  | 'fuel_drain'
  | 'pulse'
  | 'dash'
  | 'charm_picked'
  | 'drifter_steal'
  | 'drifter_drop'
  | 'player_hit'
  | 'shade_spawned'
  | 'paused'
  | 'resumed'
  | 'game_over';

export interface EventRecord {
  type: 'event';
  tick: number;
  name: EventName;
  data: Record<string, unknown>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameState;
  score: number;
}

export type JsonlRecord = SnapshotRecord | EventRecord | EndRecord;
