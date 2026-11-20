import { distXZ } from './rng.js';
import { getSurfaceY, isBlockedByObstacle, type MapConfig } from './maps.js';
import {
  ACCEL_TIME_S,
  CHARM_SPEED,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_Y_THRESHOLD,
  GRAVITY,
  JUMP_VELOCITY,
  TUNING,
  WIND_PUSH_SPEED,
} from './tuning.js';
import type { EventName, NightNumber, PlayerState, ResolvedInput, Vec3, WindState } from './types.js';

type EmitFn = (name: EventName, data: Record<string, unknown>) => void;

export function canStepHorizontal(night: NightNumber, x: number, y: number, z: number): boolean {
  if (isBlockedByObstacle(night, x, y, z)) return false;
  const surf = getSurfaceY(night, x, z);
  if (surf === null) return true; // Stepping off edge into void is allowed (player falls)
  return surf <= y + 0.55; // Allows walking up ramps, blocks 3m vertical cliff walls
}

export function moveHorizontalWithSlide(night: NightNumber, pos: Vec3, dx: number, dz: number): boolean {
  if (dx === 0 && dz === 0) return false;
  const nx = pos[0] + dx;
  const nz = pos[2] + dz;
  if (canStepHorizontal(night, nx, pos[1], nz)) {
    pos[0] = nx;
    pos[2] = nz;
    return false;
  }
  if (dx !== 0 && canStepHorizontal(night, nx, pos[1], pos[2])) {
    pos[0] = nx;
    return true;
  }
  if (dz !== 0 && canStepHorizontal(night, pos[0], pos[1], nz)) {
    pos[2] = nz;
    return true;
  }
  return true;
}

export function stepPlayerMovement(
  night: NightNumber,
  map: MapConfig,
  player: PlayerState,
  input: ResolvedInput,
  jumpEdge: boolean,
  dashEdge: boolean,
  wind: WindState,
  emit: EmitFn,
): void {
  if (player.respawnWaitTicks > 0) return;

  // 1. Transform move [x, z] by cam_yaw_deg
  const theta = (input.cam_yaw_deg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  let wx = input.move[0] * cosT + input.move[1] * sinT;
  let wz = -input.move[0] * sinT + input.move[1] * cosT;
  const mag = Math.hypot(wx, wz);
  if (mag > 1) {
    wx /= mag;
    wz /= mag;
  }
  if (mag > 1e-6) {
    player.facing = [wx / Math.min(1, mag), wz / Math.min(1, mag)];
  }

  // 2. Dash activation (14 m/s for 12 ticks, 90 tick cooldown from start; 0 cd while charmed)
  const canDash = player.dashActiveTicks === 0 && (player.dashCdTicks === 0 || player.charmTicks > 0);
  if (dashEdge && canDash) {
    player.dashActiveTicks = DASH_TICKS;
    player.dashCdTicks = player.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
    player.launchActive = false;
    player.dashDir = mag > 1e-6 ? [wx / Math.min(1, mag), wz / Math.min(1, mag)] : [player.facing[0], player.facing[1]];
    player.vel[1] = 0; // Air dash holds current height
    emit('dash', {});
  }

  // 3. Horizontal velocity
  if (player.dashActiveTicks > 0) {
    player.vel[0] = player.dashDir[0] * TUNING.dash_speed;
    player.vel[2] = player.dashDir[1] * TUNING.dash_speed;
  } else if (!player.launchActive) {
    const maxSpeed = player.charmTicks > 0 ? CHARM_SPEED : TUNING.player_speed;
    const targetVx = wx * maxSpeed;
    const targetVz = wz * maxSpeed;
    const maxDelta = (maxSpeed / ACCEL_TIME_S) * DT;
    const dvx = targetVx - player.vel[0];
    const dvz = targetVz - player.vel[2];
    const dMag = Math.hypot(dvx, dvz);
    if (dMag <= maxDelta) {
      player.vel[0] = targetVx;
      player.vel[2] = targetVz;
    } else {
      player.vel[0] += (dvx / dMag) * maxDelta;
      player.vel[2] += (dvz / dMag) * maxDelta;
    }
  }

  // 4. Jump (only when grounded and not dashing)
  if (jumpEdge && player.grounded && player.dashActiveTicks === 0) {
    player.vel[1] = JUMP_VELOCITY;
    player.grounded = false;
  }

  // 5. Horizontal displacement + Night 3 wind push
  let stepDx = player.vel[0] * DT;
  let stepDz = player.vel[2] * DT;
  if (wind.active) {
    const wRad = (wind.dirDeg * Math.PI) / 180;
    stepDx += Math.cos(wRad) * WIND_PUSH_SPEED * DT;
    stepDz += Math.sin(wRad) * WIND_PUSH_SPEED * DT;
  }
  const hitWall = moveHorizontalWithSlide(night, player.pos, stepDx, stepDz);
  if (hitWall && player.launchActive) {
    player.vel[0] = 0;
    player.vel[2] = 0;
  }

  // 6. Vertical physics & ground/cliff landing
  const surfY = getSurfaceY(night, player.pos[0], player.pos[2]);
  if (player.dashActiveTicks > 0) {
    player.vel[1] = 0;
    player.grounded = surfY !== null && Math.abs(player.pos[1] - surfY) <= 0.15;
    if (player.grounded && surfY !== null) player.pos[1] = surfY;
  } else if (player.grounded) {
    if (surfY === null || surfY < player.pos[1] - 0.55) {
      player.grounded = false;
      player.vel[1] += GRAVITY * DT;
      player.pos[1] += player.vel[1] * DT;
    } else {
      player.pos[1] = surfY;
      player.vel[1] = 0;
    }
  } else {
    player.vel[1] += GRAVITY * DT;
    const prevY = player.pos[1];
    const nextY = prevY + player.vel[1] * DT;
    if (surfY !== null && player.vel[1] <= 0 && prevY >= surfY - 0.15 && nextY <= surfY) {
      player.pos[1] = surfY;
      player.vel[1] = 0;
      player.grounded = true;
      player.launchActive = false;
    } else {
      player.pos[1] = nextY;
    }
  }

  // 7. Jump pads
  if (player.grounded && player.dashActiveTicks === 0) {
    for (const pad of map.jumpPads) {
      if (distXZ(player.pos, pad.pos) <= pad.radius && Math.abs(player.pos[1] - pad.pos[1]) <= 0.5) {
        player.vel[0] = pad.dirXZ[0] * pad.vh;
        player.vel[1] = pad.vy;
        player.vel[2] = pad.dirXZ[1] * pad.vh;
        player.grounded = false;
        player.launchActive = true;
        break;
      }
    }
  }

  // 8. Fall off island (Y < -10): once, ignores invuln
  if (TUNING.fall_enabled && player.pos[1] < FALL_Y_THRESHOLD) {
    player.flames = Math.max(0, player.flames - 1);
    const lost = player.carried;
    player.carried = 0;
    player.vel = [0, 0, 0];
    player.dashActiveTicks = 0;
    player.launchActive = false;
    emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
    if (player.flames > 0) {
      player.respawnWaitTicks = FALL_RESPAWN_TICKS;
    }
  }
}
