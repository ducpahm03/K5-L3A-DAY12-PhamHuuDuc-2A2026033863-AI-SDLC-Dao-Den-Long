import type { InputFrame, InputsFile, ScenarioSpec, Vec3 } from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

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

    for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) {
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
    if (!isPlainObject(raw.player)) {
      throw new ValidationError('scenario.player must be an object');
    }
    spec.player = {};
    if (raw.player.pos !== undefined) {
      spec.player.pos = assertVec3(raw.player.pos, 'scenario.player.pos');
    }
    if (raw.player.carried !== undefined) {
      spec.player.carried = assertNonNegInt(raw.player.carried, 'scenario.player.carried');
    }
    if (raw.player.flames !== undefined) {
      spec.player.flames = assertNonNegInt(raw.player.flames, 'scenario.player.flames');
    }
  }

  if (raw.random_motes !== undefined) {
    if (typeof raw.random_motes !== 'boolean') {
      throw new ValidationError('scenario.random_motes must be a boolean');
    }
    spec.random_motes = raw.random_motes;
  }

  if (raw.random_shades !== undefined) {
    if (typeof raw.random_shades !== 'boolean') {
      throw new ValidationError('scenario.random_shades must be a boolean');
    }
    spec.random_shades = raw.random_shades;
  }

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) {
      throw new ValidationError('scenario.motes must be an array');
    }
    spec.motes = raw.motes.map((item, i) => {
      if (Array.isArray(item)) {
        return assertVec3(item, `scenario.motes[${i}]`);
      }
      if (isPlainObject(item) && item.pos !== undefined) {
        const pos = assertVec3(item.pos, `scenario.motes[${i}].pos`);
        if (item.id !== undefined && typeof item.id !== 'string') {
          throw new ValidationError(`scenario.motes[${i}].id must be a string`);
        }
        return item.id !== undefined ? { id: item.id, pos } : { pos };
      }
      throw new ValidationError(`scenario.motes[${i}] must be [x, y, z] or { pos }`);
    });
  }

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) {
      throw new ValidationError('scenario.shades must be an array');
    }
    spec.shades = raw.shades.map((item, i) => {
      if (!isPlainObject(item)) {
        throw new ValidationError(`scenario.shades[${i}] must be an object`);
      }
      const pos = assertVec3(item.pos, `scenario.shades[${i}].pos`);
      if (item.id !== undefined && typeof item.id !== 'string') {
        throw new ValidationError(`scenario.shades[${i}].id must be a string`);
      }
      if (item.state !== undefined && item.state !== 'chase' && item.state !== 'flee' && item.state !== 'stunned') {
        throw new ValidationError(`scenario.shades[${i}].state must be chase | flee | stunned`);
      }
      return {
        ...(item.id !== undefined ? { id: item.id } : {}),
        pos,
        ...(item.state !== undefined ? { state: item.state } : {}),
      };
    });
  }

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) {
      throw new ValidationError('scenario.lanterns must be an array');
    }
    spec.lanterns = raw.lanterns.map((item, i) => {
      if (!isPlainObject(item) || typeof item.id !== 'string') {
        throw new ValidationError(`scenario.lanterns[${i}] must have string id`);
      }
      if (!validLanternIds.has(item.id)) {
        throw new ValidationError(`scenario.lanterns[${i}].id (${item.id}) is not a valid lantern id`);
      }
      const out: { id: string; pos?: Vec3; deposited?: number; lit?: boolean } = { id: item.id };
      if (item.pos !== undefined) out.pos = assertVec3(item.pos, `scenario.lanterns[${i}].pos`);
      if (item.deposited !== undefined) out.deposited = assertNonNegInt(item.deposited, `scenario.lanterns[${i}].deposited`);
      if (item.lit !== undefined) {
        if (typeof item.lit !== 'boolean') {
          throw new ValidationError(`scenario.lanterns[${i}].lit must be a boolean`);
        }
        out.lit = item.lit;
      }
      return out;
    });
  }

  if (raw.time_left_s !== undefined) {
    if (!isFiniteNumber(raw.time_left_s) || raw.time_left_s < 0) {
      throw new ValidationError('scenario.time_left_s must be a non-negative finite number');
    }
    spec.time_left_s = raw.time_left_s;
  }

  return spec;
}
