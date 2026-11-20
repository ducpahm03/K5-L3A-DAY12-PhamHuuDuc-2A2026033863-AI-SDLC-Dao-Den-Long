import type {
  DrifterState,
  InputFrame,
  InputsFile,
  MoteKind,
  ScenarioSpec,
  ShadeState,
  Vec3,
} from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_SHADE_STATES = new Set<ShadeState>(['spawning', 'wander', 'chase', 'recoil', 'stunned']);
const VALID_DRIFTER_STATES = new Set<Exclude<DrifterState, 'removed'>>(['idle', 'chase', 'flee']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function assertVec3(v: unknown, label: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) {
    throw new ValidationError(`${label} must be an array of 3 finite numbers`);
  }
  return [v[0], v[1], v[2]];
}

function assertNonNegInt(v: unknown, label: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new ValidationError(`${label} must be a non-negative integer`);
  }
  return v;
}

export function validateInputsFile(raw: unknown): InputsFile {
  if (!isPlainObject(raw)) {
    throw new ValidationError('inputs must be a JSON object');
  }
  if (!Array.isArray(raw.frames)) {
    throw new ValidationError('inputs.frames must be an array');
  }

  let prevTick = -1;
  const frames: InputFrame[] = [];

  for (let i = 0; i < raw.frames.length; i++) {
    const f = raw.frames[i];
    if (!isPlainObject(f)) {
      throw new ValidationError(`inputs.frames[${i}] must be an object`);
    }
    const tick = assertNonNegInt(f.tick, `inputs.frames[${i}].tick`);
    if (tick <= prevTick) {
      throw new ValidationError(
        `inputs.frames[${i}].tick (${tick}) must be strictly greater than previous tick (${prevTick})`,
      );
    }
    prevTick = tick;

    const frame: InputFrame = { tick };

    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isFiniteNumber)) {
        throw new ValidationError(`inputs.frames[${i}].move must be [x, z] finite numbers`);
      }
      if (f.move[0] < -1 || f.move[0] > 1 || f.move[1] < -1 || f.move[1] > 1) {
        throw new ValidationError(`inputs.frames[${i}].move components must be within [-1, 1]`);
      }
      frame.move = [f.move[0], f.move[1]];
    }

    if (f.cam_yaw_deg !== undefined) {
      if (!isFiniteNumber(f.cam_yaw_deg)) {
        throw new ValidationError(`inputs.frames[${i}].cam_yaw_deg must be a finite number`);
      }
      frame.cam_yaw_deg = f.cam_yaw_deg;
    }

    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (f[key] !== undefined) {
        if (typeof f[key] !== 'boolean') {
          throw new ValidationError(`inputs.frames[${i}].${key} must be a boolean`);
        }
        frame[key] = f[key] as boolean;
      }
    }

    frames.push(frame);
  }

  return { frames };
}

export function validateScenarioSpec(raw: unknown, validLanternIds: ReadonlySet<string>): ScenarioSpec {
  if (!isPlainObject(raw)) {
    throw new ValidationError('scenario must be a JSON object');
  }

  const spec: ScenarioSpec = {};

  if (raw.player !== undefined) {
    if (!isPlainObject(raw.player)) throw new ValidationError('scenario.player must be an object');
    spec.player = {};
    if (raw.player.pos !== undefined) spec.player.pos = assertVec3(raw.player.pos, 'scenario.player.pos');
    if (raw.player.carried !== undefined) spec.player.carried = assertNonNegInt(raw.player.carried, 'scenario.player.carried');
    if (raw.player.flames !== undefined) spec.player.flames = assertNonNegInt(raw.player.flames, 'scenario.player.flames');
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks'] as const) {
      if (raw.player[k] !== undefined) spec.player[k] = assertNonNegInt(raw.player[k], `scenario.player.${k}`);
    }
  }

  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (raw[flag] !== undefined) {
      if (typeof raw[flag] !== 'boolean') throw new ValidationError(`scenario.${flag} must be a boolean`);
      spec[flag] = raw[flag] as boolean;
    }
  }

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new ValidationError('scenario.motes must be an array');
    spec.motes = raw.motes.map((item, i) => {
      if (Array.isArray(item)) return assertVec3(item, `scenario.motes[${i}]`);
      if (isPlainObject(item) && item.pos !== undefined) {
        const pos = assertVec3(item.pos, `scenario.motes[${i}].pos`);
        if (item.id !== undefined && typeof item.id !== 'string') throw new ValidationError(`scenario.motes[${i}].id must be string`);
        if (item.kind !== undefined && item.kind !== 'random' && item.kind !== 'dropped') {
          throw new ValidationError(`scenario.motes[${i}].kind must be random | dropped`);
        }
        const ttl = item.ttl_ticks !== undefined ? assertNonNegInt(item.ttl_ticks, `scenario.motes[${i}].ttl_ticks`) : undefined;
        return {
          ...(item.id !== undefined ? { id: item.id } : {}),
          pos,
          ...(item.kind !== undefined ? { kind: item.kind as MoteKind } : {}),
          ...(ttl !== undefined ? { ttl_ticks: ttl } : {}),
        };
      }
      throw new ValidationError(`scenario.motes[${i}] must be [x, y, z] or { pos }`);
    });
  }

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new ValidationError('scenario.shades must be an array');
    spec.shades = raw.shades.map((item, i) => {
      if (!isPlainObject(item)) throw new ValidationError(`scenario.shades[${i}] must be an object`);
      const pos = assertVec3(item.pos, `scenario.shades[${i}].pos`);
      if (item.id !== undefined && typeof item.id !== 'string') throw new ValidationError(`scenario.shades[${i}].id must be string`);
      if (item.state !== undefined && !VALID_SHADE_STATES.has(item.state as ShadeState)) {
        throw new ValidationError(`scenario.shades[${i}].state must be spawning | wander | chase | recoil | stunned`);
      }
      const stl = item.state_ticks_left !== undefined ? assertNonNegInt(item.state_ticks_left, `scenario.shades[${i}].state_ticks_left`) : undefined;
      return {
        ...(item.id !== undefined ? { id: item.id } : {}),
        pos,
        ...(item.state !== undefined ? { state: item.state as ShadeState } : {}),
        ...(stl !== undefined ? { state_ticks_left: stl } : {}),
      };
    });
  }

  if (raw.drifters !== undefined) {
    if (!Array.isArray(raw.drifters)) throw new ValidationError('scenario.drifters must be an array');
    spec.drifters = raw.drifters.map((item, i) => {
      if (!isPlainObject(item)) throw new ValidationError(`scenario.drifters[${i}] must be an object`);
      const pos = assertVec3(item.pos, `scenario.drifters[${i}].pos`);
      if (item.id !== undefined && typeof item.id !== 'string') throw new ValidationError(`scenario.drifters[${i}].id must be string`);
      if (item.state !== undefined && !VALID_DRIFTER_STATES.has(item.state as Exclude<DrifterState, 'removed'>)) {
        throw new ValidationError(`scenario.drifters[${i}].state must be idle | chase | flee`);
      }
      const stolen = item.stolen !== undefined ? assertNonNegInt(item.stolen, `scenario.drifters[${i}].stolen`) : undefined;
      const stl = item.state_ticks_left !== undefined ? assertNonNegInt(item.state_ticks_left, `scenario.drifters[${i}].state_ticks_left`) : undefined;
      return {
        ...(item.id !== undefined ? { id: item.id } : {}),
        pos,
        ...(item.state !== undefined ? { state: item.state as Exclude<DrifterState, 'removed'> } : {}),
        ...(stolen !== undefined ? { stolen } : {}),
        ...(stl !== undefined ? { state_ticks_left: stl } : {}),
      };
    });
  }

  if (raw.charms !== undefined) {
    if (!Array.isArray(raw.charms)) throw new ValidationError('scenario.charms must be an array');
    spec.charms = raw.charms.map((item, i) => {
      if (!isPlainObject(item)) throw new ValidationError(`scenario.charms[${i}] must be an object`);
      const pos = assertVec3(item.pos, `scenario.charms[${i}].pos`);
      if (item.id !== undefined && typeof item.id !== 'string') throw new ValidationError(`scenario.charms[${i}].id must be string`);
      if (item.available !== undefined && typeof item.available !== 'boolean') {
        throw new ValidationError(`scenario.charms[${i}].available must be boolean`);
      }
      const rt = item.respawn_ticks !== undefined ? assertNonNegInt(item.respawn_ticks, `scenario.charms[${i}].respawn_ticks`) : undefined;
      return {
        ...(item.id !== undefined ? { id: item.id } : {}),
        pos,
        ...(item.available !== undefined ? { available: item.available } : {}),
        ...(rt !== undefined ? { respawn_ticks: rt } : {}),
      };
    });
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new ValidationError('scenario.lanterns must be an array');
    spec.lanterns = raw.lanterns.map((item, i) => {
      if (!isPlainObject(item) || typeof item.id !== 'string') throw new ValidationError(`scenario.lanterns[${i}] must have string id`);
      if (!validLanternIds.has(item.id)) throw new ValidationError(`scenario.lanterns[${i}].id (${item.id}) is invalid`);
      const out: { id: string; pos?: Vec3; deposited?: number; lit?: boolean } = { id: item.id };
      if (item.pos !== undefined) out.pos = assertVec3(item.pos, `scenario.lanterns[${i}].pos`);
      if (item.deposited !== undefined) out.deposited = assertNonNegInt(item.deposited, `scenario.lanterns[${i}].deposited`);
      if (item.lit !== undefined) {
        if (typeof item.lit !== 'boolean') throw new ValidationError(`scenario.lanterns[${i}].lit must be boolean`);
        out.lit = item.lit;
      }
      return out;
    });
  }

  if (raw.time_left_s !== undefined) {
    if (!isFiniteNumber(raw.time_left_s) || raw.time_left_s < 0) {
      throw new ValidationError('scenario.time_left_s must be non-negative finite number');
    }
    spec.time_left_s = raw.time_left_s;
  }

  return spec;
}
