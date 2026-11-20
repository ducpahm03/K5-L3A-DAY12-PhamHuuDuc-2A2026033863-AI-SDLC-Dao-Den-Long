export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'chase' | 'flee' | 'stunned';

export interface InputFrame {
  tick: number;
  move?: Vec2;
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
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
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeState;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3 };

export interface ScenarioSpec {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3;
  velY: number;
  flames: number;
  carried: number;
  invulnTimer: number;
  pulseCooldown: number;
}

export interface LanternEntity {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface ShadeEntity {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stunTimer: number;
}

export interface MoteEntity {
  id: string;
  pos: Vec3;
}

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameState;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3;
    flames: number;
    carried: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
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
  }>;
}

export type EventName =
  | 'mote_picked'
  | 'deposit'
  | 'lantern_lit'
  | 'pulse'
  | 'player_hit'
  | 'shade_spawned'
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
