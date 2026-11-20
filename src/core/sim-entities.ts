import { distXZ } from './rng.js';
import { getSurfaceY, isBlockedByObstacle, type MapConfig } from './maps.js';
import {
  DRIFTER_DETECT_RADIUS,
  DRIFTER_FLEE_TICKS,
  DRIFTER_MIN_CARRIED,
  DRIFTER_SPEED_ACTIVE,
  DRIFTER_SPEED_IDLE,
  DRIFTER_STEAL_MAX,
  DRIFTER_STEAL_RADIUS,
  DT,
  INVULN_TICKS,
  PULSE_PUSH_TICKS,
  SHADE_DEFAULT_Y,
  SHADE_DETECT_RADIUS,
  SHADE_HEIGHT_TOLERANCE,
  SHADE_LOSE_RADIUS,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  TUNING,
} from './tuning.js';
import type {
  DrifterEntity,
  EventName,
  LanternEntity,
  NightNumber,
  PlayerState,
  ShadeEntity,
  Vec3,
} from './types.js';

type EmitFn = (name: EventName, data: Record<string, unknown>) => void;
type SpawnDroppedFn = (cx: number, cy: number, cz: number, count: number, ring: boolean) => void;

export function clampShadeOutsideSafeZones(pos: Vec3, lanterns: LanternEntity[]): void {
  for (const l of lanterns) {
    if (!l.lit) continue;
    const dx = pos[0] - l.pos[0];
    const dz = pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < TUNING.safe_radius) {
      const nx = d > 1e-9 ? dx / d : 1;
      const nz = d > 1e-9 ? dz / d : 0;
      pos[0] = l.pos[0] + nx * (TUNING.safe_radius + 0.001);
      pos[2] = l.pos[2] + nz * (TUNING.safe_radius + 0.001);
    }
  }
}

export function updateSafeZones(shades: ShadeEntity[], lanterns: LanternEntity[]): void {
  for (const shade of shades) {
    if (shade.safePushTicks > 0 && shade.safePushSource) {
      const [lx, lz] = shade.safePushSource;
      const dx = shade.pos[0] - lx;
      const dz = shade.pos[2] - lz;
      const d = Math.hypot(dx, dz);
      const target = TUNING.safe_radius + 0.05;
      if (d >= target) {
        shade.safePushTicks = 0;
        shade.safePushSource = null;
      } else {
        const nx = d > 1e-9 ? dx / d : 1;
        const nz = d > 1e-9 ? dz / d : 0;
        const step = Math.max((target - d) / shade.safePushTicks, 0.22);
        shade.pos[0] += nx * Math.min(step, target - d);
        shade.pos[2] += nz * Math.min(step, target - d);
        shade.safePushTicks--;
        if (shade.safePushTicks <= 0 || Math.hypot(shade.pos[0] - lx, shade.pos[2] - lz) >= target) {
          shade.safePushTicks = 0;
          shade.safePushSource = null;
        }
      }
      continue;
    }
    clampShadeOutsideSafeZones(shade.pos, lanterns);
  }
}

function tryMoveShade(night: NightNumber, pos: Vec3, dx: number, dz: number): boolean {
  const nx = pos[0] + dx;
  const nz = pos[2] + dz;
  const surf = getSurfaceY(night, nx, nz);
  if (surf === null || isBlockedByObstacle(night, nx, surf + 0.5, nz)) {
    return false;
  }
  pos[0] = nx;
  pos[2] = nz;
  pos[1] = surf + SHADE_DEFAULT_Y;
  return true;
}

export function moveShadesAndDrifters(
  night: NightNumber,
  map: MapConfig,
  player: PlayerState,
  lanterns: LanternEntity[],
  shades: ShadeEntity[],
  drifters: DrifterEntity[],
  simTick: number,
): void {
  const playerActive = player.respawnWaitTicks === 0;

  for (const shade of shades) {
    if (shade.spawnTick === simTick) continue;

    if (shade.state === 'spawning') {
      if (shade.stateTicksLeft <= 0) shade.state = 'wander';
      continue;
    }

    if (shade.state === 'stunned') {
      if (shade.pushTicksLeft > 0) {
        const pushStep = TUNING.pulse_push_m / PULSE_PUSH_TICKS;
        const moved = tryMoveShade(night, shade.pos, shade.pushDir[0] * pushStep, shade.pushDir[1] * pushStep);
        if (!moved) shade.pushTicksLeft = 0;
        else shade.pushTicksLeft--;
        clampShadeOutsideSafeZones(shade.pos, lanterns);
      }
      if (shade.stateTicksLeft <= 0) shade.state = 'wander';
      continue;
    }

    if (shade.state === 'recoil') {
      const recoilStep = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
      tryMoveShade(night, shade.pos, shade.recoilDir[0] * recoilStep, shade.recoilDir[1] * recoilStep);
      clampShadeOutsideSafeZones(shade.pos, lanterns);
      if (shade.stateTicksLeft <= 0) shade.state = 'wander';
      continue;
    }

    if (shade.safePushTicks > 0) continue;

    const dPlayer = distXZ(shade.pos, player.pos);
    if (shade.state === 'wander') {
      if (playerActive && dPlayer <= SHADE_DETECT_RADIUS) {
        shade.state = 'chase';
      }
    } else if (shade.state === 'chase') {
      if (!playerActive || dPlayer > SHADE_LOSE_RADIUS) {
        shade.state = 'wander';
      }
    }

    if (shade.state === 'chase') {
      const dx = player.pos[0] - shade.pos[0];
      const dz = player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const step = Math.min(d, map.shadeSpeed * DT);
        tryMoveShade(night, shade.pos, (dx / d) * step, (dz / d) * step);
      }
      clampShadeOutsideSafeZones(shade.pos, lanterns);
    } else {
      // Wander toward nearest unlit lantern slowly
      let target: LanternEntity | null = null;
      let best = Infinity;
      for (const l of lanterns) {
        if (l.lit) continue;
        const d = distXZ(shade.pos, l.pos);
        if (d < best) {
          best = d;
          target = l;
        }
      }
      if (target && best > 2.5) {
        const dx = target.pos[0] - shade.pos[0];
        const dz = target.pos[2] - shade.pos[2];
        const step = map.shadeSpeed * 0.55 * DT;
        tryMoveShade(night, shade.pos, (dx / best) * step, (dz / best) * step);
        clampShadeOutsideSafeZones(shade.pos, lanterns);
      }
    }
  }

  // Drifters (Night 2 & 3)
  for (let i = drifters.length - 1; i >= 0; i--) {
    const dr = drifters[i];
    if (dr.spawnTick === simTick) continue;
    if (dr.state === 'flee') {
      const dx = dr.pos[0] - player.pos[0];
      const dz = dr.pos[2] - player.pos[2];
      const d = Math.hypot(dx, dz);
      const nx = d > 1e-9 ? dx / d : 1;
      const nz = d > 1e-9 ? dz / d : 0;
      dr.pos[0] += nx * DRIFTER_SPEED_ACTIVE * DT;
      dr.pos[2] += nz * DRIFTER_SPEED_ACTIVE * DT;
      if (dr.stateTicksLeft <= 0) {
        dr.state = 'removed';
        drifters.splice(i, 1);
      }
      continue;
    }

    const dPlayer = distXZ(dr.pos, player.pos);
    const shouldChase = playerActive && !dr.hasStolen && player.carried >= DRIFTER_MIN_CARRIED && dPlayer <= DRIFTER_DETECT_RADIUS;
    if (dr.state === 'idle' && shouldChase) {
      dr.state = 'chase';
    } else if (dr.state === 'chase' && !shouldChase) {
      dr.state = 'idle';
    }

    if (dr.state === 'chase') {
      const dx = player.pos[0] - dr.pos[0];
      const dz = player.pos[2] - dr.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const step = Math.min(d, DRIFTER_SPEED_ACTIVE * DT);
        dr.pos[0] += (dx / d) * step;
        dr.pos[2] += (dz / d) * step;
      }
    } else {
      // Idle gentle drift
      dr.idleAngle += 0.6 * DT;
      const nx = dr.pos[0] + Math.cos(dr.idleAngle) * DRIFTER_SPEED_IDLE * DT;
      const nz = dr.pos[2] + Math.sin(dr.idleAngle) * DRIFTER_SPEED_IDLE * DT;
      if (getSurfaceY(night, nx, nz) !== null) {
        dr.pos[0] = nx;
        dr.pos[2] = nz;
      } else {
        dr.idleAngle += Math.PI * 0.7;
      }
    }
  }
}

export function resolveCollisions(
  player: PlayerState,
  shades: ShadeEntity[],
  drifters: DrifterEntity[],
  simTick: number,
  emit: EmitFn,
  spawnDropped: SpawnDroppedFn,
): void {
  if (player.respawnWaitTicks > 0 || player.flames <= 0) return;

  // 1. Drifters steal FIRST (ascending ID order, ignores invuln & safe zones)
  const sortedDrifters = [...drifters].sort((a, b) => a.id.localeCompare(b.id));
  for (const dr of sortedDrifters) {
    if (dr.spawnTick === simTick || dr.state !== 'chase' || dr.hasStolen) continue;
    if (distXZ(player.pos, dr.pos) <= DRIFTER_STEAL_RADIUS) {
      const amount = Math.min(DRIFTER_STEAL_MAX, player.carried);
      player.carried -= amount;
      dr.stolen = amount;
      dr.hasStolen = true;
      dr.state = 'flee';
      dr.stateTicksLeft = DRIFTER_FLEE_TICKS;
      emit('drifter_steal', { drifter_id: dr.id, amount, carried: player.carried });
    }
  }

  // 2. Shades hit (ascending ID order, max 1 flame lost per tick)
  if (player.invulnTicks > 0) return;
  const sortedShades = [...shades].sort((a, b) => a.id.localeCompare(b.id));
  for (const shade of sortedShades) {
    if (shade.spawnTick === simTick) continue;
    if (shade.state !== 'wander' && shade.state !== 'chase') continue;
    if (shade.safePushTicks > 0) continue;

    const dXZ = distXZ(player.pos, shade.pos);
    const dY = Math.abs(player.pos[1] - shade.pos[1]);
    if (dXZ <= TUNING.shade_hit_radius && dY <= SHADE_HEIGHT_TOLERANCE) {
      player.flames = Math.max(0, player.flames - 1);
      const dropped = Math.floor(player.carried * TUNING.hit_drop_ratio);
      player.carried -= dropped;
      if (dropped > 0) {
        spawnDropped(player.pos[0], player.pos[1], player.pos[2], dropped, true);
      }
      player.invulnTicks = INVULN_TICKS;

      const rx = shade.pos[0] - player.pos[0];
      const rz = shade.pos[2] - player.pos[2];
      const rd = Math.hypot(rx, rz);
      shade.recoilDir = rd > 1e-9 ? [rx / rd, rz / rd] : [1, 0];
      shade.state = 'recoil';
      shade.stateTicksLeft = SHADE_RECOIL_TICKS;

      emit('player_hit', { by: 'shade', flames: player.flames, dropped });
      break; // Max 1 flame lost per tick
    }
  }
}
