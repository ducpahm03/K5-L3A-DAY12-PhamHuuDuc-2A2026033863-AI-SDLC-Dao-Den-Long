import { distXZ, round1, round3, SeededRng } from './rng.js';
import { getMapConfig, getSurfaceY, type MapConfig } from './maps.js';
import { moveShadesAndDrifters, resolveCollisions, updateSafeZones } from './sim-entities.js';
import { stepPlayerMovement } from './sim-movement.js';
import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_MAX_COUNT,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DROPPED_MOTE_TTL_TICKS,
  FUEL_DECAY_UNITS_PER_TICK,
  FUEL_DRAIN_UNITS_PER_TICK,
  FUEL_LOW_THRESHOLD_UNITS,
  FUEL_MAX_UNITS,
  FUEL_PER_MOTE_UNITS,
  FUEL_UNIT_SCALE,
  INITIAL_RANDOM_MOTES,
  INVULN_TICKS,
  MAX_ACTIVE_MOTES,
  MOTE_HEIGHT_TOLERANCE,
  MOTE_SPAWN_INTERVAL_TICKS,
  PULSE_CENTER_Y_OFFSET,
  PULSE_COOLDOWN_TICKS,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  SAFE_PUSH_MAX_TICKS,
  SCORE_DAWN_PER_LIT_LANTERN,
  SCORE_PULSE_DRAIN,
  SCORE_RELIGHT,
  SHADE_DEFAULT_Y,
  SHADE_DRAIN_RADIUS,
  SHADE_SPAWNING_TICKS,
  SHADE_SPAWN_FIRST_TICK,
  TICK_RATE,
  TUNING,
  WIND_DURATION_TICKS,
  WIND_INTERVAL_TICKS,
  WIND_WARN_TICKS,
} from './tuning.js';
import type {
  CharmEntity,
  DrifterEntity,
  EndRecord,
  EventName,
  EventRecord,
  GameState,
  InputFrame,
  LanternEntity,
  MoteEntity,
  NightNumber,
  PlayerState,
  ResolvedInput,
  ScenarioSpec,
  ShadeEntity,
  SnapshotRecord,
  Vec3,
  WindState,
} from './types.js';

export function createDefaultInput(): ResolvedInput {
  return { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
}

export class InputTimeline {
  private readonly frames: InputFrame[];
  private cursor = 0;
  private current: ResolvedInput = createDefaultInput();

  constructor(frames: InputFrame[] = []) {
    this.frames = frames;
  }

  atTick(tick: number): ResolvedInput {
    while (this.cursor < this.frames.length && this.frames[this.cursor].tick <= tick) {
      const f = this.frames[this.cursor];
      if (f.move !== undefined) this.current.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) this.current.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) this.current.jump = f.jump;
      if (f.interact !== undefined) this.current.interact = f.interact;
      if (f.pulse !== undefined) this.current.pulse = f.pulse;
      if (f.dash !== undefined) this.current.dash = f.dash;
      if (f.pause !== undefined) this.current.pause = f.pause;
      this.cursor++;
    }
    return { ...this.current, move: [this.current.move[0], this.current.move[1]] };
  }
}

export class Simulation {
  public readonly seed: number;
  public readonly night: NightNumber;
  public readonly map: MapConfig;
  public tick = 0;
  public simTick = 0;
  public state: GameState = 'playing';
  public score = 0;
  public timeLeftS: number;
  public readonly startTimeS: number;
  public readonly player: PlayerState;
  public readonly lanterns: LanternEntity[];
  public readonly shades: ShadeEntity[] = [];
  public readonly motes: MoteEntity[] = [];
  public readonly drifters: DrifterEntity[] = [];
  public readonly charms: CharmEntity[] = [];
  public readonly wind: WindState = { active: false, warning: false, dirDeg: 0, ticksLeft: 0 };

  private readonly rng: SeededRng;
  private readonly randomMotes: boolean;
  private readonly randomShades: boolean;
  private readonly randomDrifters: boolean;
  private readonly windEnabled: boolean;
  private nextMoteNum = 1;
  private nextShadeNum = 1;
  private nextDrifterNum = 1;
  private nextCharmNum = 1;
  private readonly usedIds = new Set<string>();
  private prevInput: ResolvedInput = createDefaultInput();

  constructor(seed: number, night: NightNumber = 1, scenario?: ScenarioSpec) {
    this.seed = seed;
    this.night = night;
    this.map = getMapConfig(night);
    this.rng = new SeededRng(seed);
    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.randomDrifters = scenario?.random_drifters ?? this.map.driftersEnabled;
    this.windEnabled = scenario?.wind_enabled ?? this.map.windEnabledByDefault;
    this.startTimeS = scenario?.time_left_s ?? this.map.durationS;
    this.timeLeftS = round3(this.startTimeS);

    const startPos: Vec3 = scenario?.player?.pos ? [...scenario.player.pos] : [...this.map.spawnPos];
    const startSurf = getSurfaceY(night, startPos[0], startPos[2]);
    const succLights = scenario?.player?.successful_lights ?? 0;
    this.player = {
      pos: startPos,
      vel: [0, 0, 0],
      grounded: startSurf !== null && Math.abs(startPos[1] - startSurf) <= 0.15,
      facing: [0, 1],
      flames: scenario?.player?.flames ?? TUNING.flames,
      carried: scenario?.player?.carried ?? 0,
      successfulLights: succLights,
      capacity: Math.min(TUNING.capacity_max, TUNING.carry_capacity + 2 * succLights),
      invulnTicks: scenario?.player?.invuln_ticks ?? 0,
      dashCdTicks: scenario?.player?.dash_cd_ticks ?? 0,
      dashActiveTicks: 0,
      dashDir: [0, 1],
      pulseCdTicks: scenario?.player?.pulse_cd_ticks ?? 0,
      charmTicks: scenario?.player?.charm_ticks ?? 0,
      respawnWaitTicks: 0,
      launchActive: false,
    };

    this.lanterns = this.map.lanterns.map((d) => ({
      id: d.id,
      pos: [...d.pos],
      lit: false,
      deposited: 0,
      fuelUnits: 0,
      everLit: false,
      relitCount: 0,
    }));

    if (scenario?.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) target.pos = [...patch.pos];
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
        if (patch.ever_lit !== undefined) target.everLit = patch.ever_lit;
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
        } else if (patch.fuel !== undefined && patch.fuel > 0) {
          target.lit = true;
        } else if (target.deposited >= (target.everLit ? TUNING.relight_cost : TUNING.lantern_cost)) {
          target.lit = true;
        }
        if (target.lit) {
          const f = patch.fuel !== undefined ? patch.fuel : TUNING.fuel_max;
          target.fuelUnits = Math.round(f * FUEL_UNIT_SCALE);
          target.everLit = patch.ever_lit ?? true;
          if (patch.deposited === undefined) {
            target.deposited = TUNING.lantern_cost;
          }
        } else {
          target.fuelUnits = 0;
        }
      }
    }

    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        const pos: Vec3 = Array.isArray(m) ? [...m] : [...m.pos];
        const kind = Array.isArray(m) ? 'random' : (m.kind ?? 'random');
        const ttl = Array.isArray(m) ? null : (m.ttl_ticks ?? (kind === 'dropped' ? DROPPED_MOTE_TTL_TICKS : null));
        const id = !Array.isArray(m) && m.id ? m.id : this.allocId('M');
        this.usedIds.add(id);
        this.motes.push({ id, pos, kind, ttlTicks: ttl, pickupReadyTick: 0 });
      }
    } else if (this.randomMotes) {
      const pool = [...this.map.motePoints];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const count = Math.min(INITIAL_RANDOM_MOTES, pool.length);
      for (let i = 0; i < count; i++) {
        this.motes.push({ id: this.allocId('M'), pos: [...pool[i]], kind: 'random', ttlTicks: null, pickupReadyTick: 0 });
      }
    }

    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? this.allocId('S');
        this.usedIds.add(id);
        const st = s.state ?? 'wander';
        const defaultTicks = st === 'stunned' ? PULSE_STUN_TICKS : st === 'recoil' ? 60 : st === 'spawning' ? SHADE_SPAWNING_TICKS : 0;
        let targetLId = s.target_lantern_id ?? null;
        if (st === 'drain' && !targetLId) {
          const nearL = this.lanterns.find((l) => l.lit && distXZ(s.pos, l.pos) <= SHADE_DRAIN_RADIUS);
          if (nearL) targetLId = nearL.id;
        }
        this.shades.push({
          id,
          pos: [...s.pos],
          state: st,
          stateTicksLeft: s.state_ticks_left ?? defaultTicks,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safePushTicks: 0,
          safePushSource: null,
          targetLanternId: targetLId,
          drainTicks: 0,
          spawnTick: -1,
        });
      }
    }

    if (scenario?.drifters !== undefined) {
      for (const d of scenario.drifters) {
        const id = d.id ?? this.allocId('D');
        this.usedIds.add(id);
        const st = d.state ?? 'idle';
        this.drifters.push({
          id,
          pos: [...d.pos],
          state: st,
          stolen: d.stolen ?? 0,
          hasStolen: (d.stolen ?? 0) > 0 || st === 'flee',
          stateTicksLeft: d.state_ticks_left ?? (st === 'flee' ? 240 : 0),
          idleAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1,
        });
      }
    }

    const charmList = scenario?.charms !== undefined ? scenario.charms : this.map.charms;
    for (const c of charmList) {
      const id = c.id ?? this.allocId('C');
      this.usedIds.add(id);
      this.charms.push({
        id,
        pos: [...c.pos],
        available: 'available' in c && c.available !== undefined ? c.available : true,
        respawnTicks: 'respawn_ticks' in c && c.respawn_ticks !== undefined ? c.respawn_ticks : 0,
      });
    }
  }

  private allocId(prefix: 'M' | 'S' | 'D' | 'C'): string {
    const getNext = () => {
      if (prefix === 'M') return this.nextMoteNum++;
      if (prefix === 'S') return this.nextShadeNum++;
      if (prefix === 'D') return this.nextDrifterNum++;
      return this.nextCharmNum++;
    };
    let id = `${prefix}${getNext()}`;
    while (this.usedIds.has(id)) id = `${prefix}${getNext()}`;
    this.usedIds.add(id);
    return id;
  }

  private spawnDroppedMotes = (cx: number, cy: number, cz: number, count: number, ring: boolean): void => {
    for (let i = 0; i < count; i++) {
      let mx = cx;
      let mz = cz;
      if (ring) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(1.5, 2.5);
        mx = cx + Math.cos(a) * r;
        mz = cz + Math.sin(a) * r;
      }
      const surf = getSurfaceY(this.night, mx, mz);
      const my = surf !== null ? surf : cy;
      this.motes.push({
        id: this.allocId('M'),
        pos: [round3(mx), round3(my), round3(mz)],
        kind: 'dropped',
        ttlTicks: DROPPED_MOTE_TTL_TICKS,
        pickupReadyTick: this.simTick + 1,
      });
    }
  };

  step(input: ResolvedInput): EventRecord[] {
    if (this.state === 'won' || this.state === 'lost') return [];

    const events: EventRecord[] = [];
    const nextTick = this.tick + 1;
    const emit = (name: EventName, data: Record<string, unknown>): void => {
      events.push({ type: 'event', tick: nextTick, name, data });
    };

    // STEP 1: Input (pause first)
    const pauseEdge = !this.prevInput.pause && input.pause;
    const jumpEdge = !this.prevInput.jump && input.jump;
    const interactEdge = !this.prevInput.interact && input.interact;
    const pulseEdge = !this.prevInput.pulse && input.pulse;
    const dashEdge = !this.prevInput.dash && input.dash;
    this.prevInput = { ...input, move: [input.move[0], input.move[1]] };

    if (pauseEdge) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.tick = nextTick;
        emit('paused', {});
        return events;
      }
      if (this.state === 'paused') {
        this.state = 'playing';
        emit('resumed', {});
      }
    }
    if (this.state === 'paused') {
      this.tick = nextTick;
      return events;
    }

    // STEP 2: Decrement timers + fuel decay + shade drain -> immediate lantern_out
    this.tick = nextTick;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, round3(this.startTimeS - this.simTick / TICK_RATE));

    if (this.player.dashCdTicks > 0) this.player.dashCdTicks--;
    if (this.player.dashActiveTicks > 0) this.player.dashActiveTicks--;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks--;
    if (this.player.invulnTicks > 0) this.player.invulnTicks--;
    if (this.player.charmTicks > 0) this.player.charmTicks--;
    if (this.player.respawnWaitTicks > 0) {
      this.player.respawnWaitTicks--;
      if (this.player.respawnWaitTicks === 0 && this.player.flames > 0) {
        this.player.pos = [...this.map.spawnPos];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.invulnTicks = INVULN_TICKS;
      }
    }
    for (const s of this.shades) if (s.stateTicksLeft > 0) s.stateTicksLeft--;
    for (const d of this.drifters) if (d.stateTicksLeft > 0) d.stateTicksLeft--;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      if (this.motes[i].ttlTicks !== null) {
        this.motes[i].ttlTicks!--;
        if (this.motes[i].ttlTicks! <= 0) this.motes.splice(i, 1);
      }
    }
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks--;
        if (c.respawnTicks === 0) c.available = true;
      }
    }

    // Fuel natural decay (1/60 per tick) + shade drain (5/60 per tick)
    for (const l of this.lanterns) {
      if (l.lit) l.fuelUnits -= FUEL_DECAY_UNITS_PER_TICK;
    }
    const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
    for (const s of sortedShades) {
      if (s.state === 'drain' && s.targetLanternId) {
        const l = this.lanterns.find((x) => x.id === s.targetLanternId);
        if (l && l.lit) {
          l.fuelUnits -= FUEL_DRAIN_UNITS_PER_TICK;
          s.drainTicks++;
          if (s.drainTicks % 60 === 0) {
            emit('fuel_drain', {
              lantern_id: l.id,
              shade_id: s.id,
              fuel: round1(Math.max(0, l.fuelUnits) / FUEL_UNIT_SCALE),
            });
          }
        }
      }
    }
    // Right after Step 2: lanterns with fuel <= 0 turn off immediately
    for (const l of this.lanterns) {
      if (l.lit && l.fuelUnits <= 0) {
        l.fuelUnits = 0;
        l.lit = false;
        l.deposited = 0;
        l.everLit = true;
        emit('lantern_out', { lantern_id: l.id });
        for (const s of this.shades) {
          if (s.targetLanternId === l.id) {
            s.state = 'wander';
            s.targetLanternId = null;
            s.drainTicks = 0;
          }
        }
      }
    }
    this.updateWindCycle();

    // STEP 3: Move Mây & fall check
    stepPlayerMovement(this.night, this.map, this.player, input, jumpEdge, dashEdge, this.wind, emit);

    // STEP 4: Pick up motes (respecting dynamic player.capacity) and charms
    if (this.player.respawnWaitTicks === 0 && this.player.flames > 0) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.player.carried >= this.player.capacity) break;
        const m = this.motes[i];
        if (
          m.pickupReadyTick <= this.simTick &&
          distXZ(this.player.pos, m.pos) <= TUNING.pickup_radius &&
          Math.abs(this.player.pos[1] - m.pos[1]) <= MOTE_HEIGHT_TOLERANCE
        ) {
          this.motes.splice(i, 1);
          this.player.carried++;
          emit('mote_picked', { carried: this.player.carried });
        } else {
          i++;
        }
      }
      for (const c of this.charms) {
        if (
          c.available &&
          distXZ(this.player.pos, c.pos) <= TUNING.pickup_radius &&
          Math.abs(this.player.pos[1] - c.pos[1]) <= MOTE_HEIGHT_TOLERANCE
        ) {
          c.available = false;
          c.respawnTicks = CHARM_RESPAWN_TICKS;
          this.player.charmTicks = CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          emit('charm_picked', { charm_id: c.id, charm_ticks: CHARM_DURATION_TICKS });
        }
      }
    }

    // STEP 5: Interact with lanterns (unlit OR lit with fuel < 100)
    if (interactEdge && this.player.carried > 0 && this.player.respawnWaitTicks === 0 && this.player.flames > 0) {
      let best: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const l of this.lanterns) {
        if (l.lit && l.fuelUnits >= FUEL_MAX_UNITS) continue; // Full fuel lantern not selectable
        const d = distXZ(this.player.pos, l.pos);
        if (d <= TUNING.interact_radius && Math.abs(this.player.pos[1] - l.pos[1]) <= 2.5) {
          if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && best && l.id.localeCompare(best.id) < 0)) {
            bestDist = d;
            best = l;
          }
        }
      }
      if (best) {
        if (!best.lit) {
          const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
          const needed = Math.max(0, cost - best.deposited);
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            best.deposited += amount;
            this.score += amount * TUNING.score.per_mote;
            emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
            if (best.deposited >= cost) {
              const isRelight = best.everLit;
              best.lit = true;
              best.fuelUnits = FUEL_MAX_UNITS;
              best.everLit = true;
              if (isRelight) best.relitCount++;
              this.score += isRelight ? SCORE_RELIGHT : TUNING.score.per_lantern;
              this.player.successfulLights++;
              this.player.capacity = Math.min(
                TUNING.capacity_max,
                TUNING.carry_capacity + 2 * this.player.successfulLights,
              );
              emit('lantern_lit', { lantern_id: best.id, relight: isRelight });
              for (const s of this.shades) {
                if (distXZ(s.pos, best.pos) < TUNING.safe_radius) {
                  s.safePushTicks = SAFE_PUSH_MAX_TICKS;
                  s.safePushSource = [best.pos[0], best.pos[2]];
                }
              }
            }
          }
        } else {
          // Refuel lit lantern
          const neededMotes = Math.ceil((FUEL_MAX_UNITS - best.fuelUnits) / FUEL_PER_MOTE_UNITS);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            const wasLow = best.fuelUnits < FUEL_LOW_THRESHOLD_UNITS;
            this.player.carried -= used;
            best.fuelUnits = Math.min(FUEL_MAX_UNITS, best.fuelUnits + used * FUEL_PER_MOTE_UNITS);
            this.score += used * TUNING.score.per_mote;
            emit('refuel', {
              lantern_id: best.id,
              amount: used,
              fuel: round1(best.fuelUnits / FUEL_UNIT_SCALE),
            });
            if (best.fuelUnits >= FUEL_LOW_THRESHOLD_UNITS) {
              for (const s of this.shades) {
                if (s.targetLanternId === best.id) {
                  s.state = 'wander';
                  s.targetLanternId = null;
                  s.drainTicks = 0;
                }
                if (wasLow && distXZ(s.pos, best.pos) < TUNING.safe_radius) {
                  s.safePushTicks = SAFE_PUSH_MAX_TICKS;
                  s.safePushSource = [best.pos[0], best.pos[2]];
                }
              }
            }
          }
        }
      }
    }

    // STEP 6: Update safe zones
    updateSafeZones(this.shades, this.lanterns);

    // STEP 7: Pulse (+15 if shade was drain, else +5)
    if (
      pulseEdge &&
      this.player.pulseCdTicks === 0 &&
      this.player.carried >= TUNING.pulse_cost &&
      this.player.respawnWaitTicks === 0 &&
      this.player.flames > 0
    ) {
      this.player.carried -= TUNING.pulse_cost;
      this.player.pulseCdTicks = PULSE_COOLDOWN_TICKS;
      const cx = this.player.pos[0];
      const cy = this.player.pos[1] + PULSE_CENTER_Y_OFFSET;
      const cz = this.player.pos[2];
      const stunnedIds: string[] = [];

      for (const s of this.shades) {
        if (s.spawnTick === this.simTick) continue;
        const d3 = Math.hypot(s.pos[0] - cx, s.pos[1] - cy, s.pos[2] - cz);
        if (d3 <= TUNING.pulse_radius) {
          const wasDrain = s.state === 'drain';
          const dx = s.pos[0] - cx;
          const dz = s.pos[2] - cz;
          const dh = Math.hypot(dx, dz);
          s.pushDir = dh > 1e-9 ? [dx / dh, dz / dh] : [1, 0];
          s.pushTicksLeft = PULSE_PUSH_TICKS;
          s.state = 'stunned';
          s.stateTicksLeft = PULSE_STUN_TICKS;
          s.targetLanternId = null;
          s.drainTicks = 0;
          this.score += wasDrain ? SCORE_PULSE_DRAIN : TUNING.score.per_stun;
          stunnedIds.push(s.id);
        }
      }
      for (const dr of this.drifters) {
        if (dr.spawnTick === this.simTick) continue;
        const d3 = Math.hypot(dr.pos[0] - cx, dr.pos[1] - cy, dr.pos[2] - cz);
        if (d3 <= TUNING.pulse_radius) {
          if (dr.state === 'chase') {
            dr.state = 'flee';
            dr.stateTicksLeft = DRIFTER_DROP_FLEE_TICKS;
          } else if (dr.state === 'flee' && dr.stolen > 0) {
            const amt = dr.stolen;
            dr.stolen = 0;
            dr.stateTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            this.spawnDroppedMotes(dr.pos[0], dr.pos[1], dr.pos[2], amt, false);
            emit('drifter_drop', { drifter_id: dr.id, amount: amt });
          }
        }
      }
      emit('pulse', { stunned_ids: stunnedIds });
    }

    // STEP 8: Move Shades & Drifters
    moveShadesAndDrifters(this.night, this.map, this.player, this.lanterns, this.shades, this.drifters, this.simTick);

    // STEP 9: Collisions
    resolveCollisions(this.player, this.shades, this.drifters, this.simTick, emit, this.spawnDroppedMotes);

    // STEP 10: Scheduled Spawns
    this.stepSpawners(emit);

    // STEP 11: Win / Loss check (no_flames ALWAYS first; at dawn check lit >= ceil(0.6 * total))
    if (this.player.flames <= 0) {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'no_flames' });
    } else if (this.timeLeftS <= 0) {
      const req = Math.ceil(TUNING.win_ratio * this.lanterns.length);
      const litLanterns = this.lanterns.filter((l) => l.lit);
      if (litLanterns.length >= req) {
        for (const l of litLanterns) {
          this.score += SCORE_DAWN_PER_LIT_LANTERN + Math.floor(l.fuelUnits / FUEL_UNIT_SCALE);
        }
        this.score += this.player.flames * TUNING.score.per_flame_left;
        this.state = 'won';
        emit('game_over', { result: 'won', reason: 'dawn_survived' });
      } else {
        this.state = 'lost';
        emit('game_over', { result: 'lost', reason: 'dawn' });
      }
    }

    return events;
  }

  private updateWindCycle(): void {
    if (!this.windEnabled) {
      this.wind.active = false;
      this.wind.warning = false;
      return;
    }
    if (this.wind.active) {
      this.wind.ticksLeft--;
      if (this.wind.ticksLeft <= 0) this.wind.active = false;
      return;
    }
    const mod = this.simTick % WIND_INTERVAL_TICKS;
    if (mod === WIND_INTERVAL_TICKS - WIND_WARN_TICKS) {
      this.wind.warning = true;
      this.wind.dirDeg = round3(this.rng.range(0, 360));
    } else if (this.simTick > 0 && mod === 0) {
      this.wind.warning = false;
      this.wind.active = true;
      this.wind.ticksLeft = WIND_DURATION_TICKS;
    }
  }

  private stepSpawners(emit: (name: EventName, data: Record<string, unknown>) => void): void {
    if (this.randomMotes && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0 && this.motes.length < MAX_ACTIVE_MOTES) {
      const free = this.map.motePoints.filter((pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5));
      if (free.length > 0) {
        const chosen = free[Math.floor(this.rng.next() * free.length)];
        this.motes.push({
          id: this.allocId('M'),
          pos: [...chosen],
          kind: 'random',
          ttlTicks: null,
          pickupReadyTick: this.simTick + 1,
        });
      }
    }

    if (this.randomShades && this.simTick >= SHADE_SPAWN_FIRST_TICK) {
      const count =
        this.simTick === SHADE_SPAWN_FIRST_TICK
          ? 2
          : (this.simTick - SHADE_SPAWN_FIRST_TICK) % this.map.shadeIntervalTicks === 0
            ? 1
            : 0;
      for (let i = 0; i < count && this.shades.length < this.map.shadeMaxCount; i++) {
        const valid = this.map.shadePoints.filter(
          (pt) =>
            distXZ(pt, this.player.pos) >= 15 &&
            !this.lanterns.some((l) => l.lit && l.fuelUnits >= FUEL_LOW_THRESHOLD_UNITS && distXZ(pt, l.pos) < TUNING.safe_radius),
        );
        if (valid.length === 0) break;
        const chosen = valid[Math.floor(this.rng.next() * valid.length)];
        const id = this.allocId('S');
        this.shades.push({
          id,
          pos: [chosen[0], chosen[1] + SHADE_DEFAULT_Y, chosen[2]],
          state: 'spawning',
          stateTicksLeft: SHADE_SPAWNING_TICKS,
          pushTicksLeft: 0,
          pushDir: [1, 0],
          recoilDir: [1, 0],
          safePushTicks: 0,
          safePushSource: null,
          targetLanternId: null,
          drainTicks: 0,
          spawnTick: this.simTick,
        });
        emit('shade_spawned', { id });
      }
    }

    if (
      this.randomDrifters &&
      this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0 &&
      this.drifters.length < DRIFTER_MAX_COUNT &&
      this.map.shadePoints.length > 0
    ) {
      const chosen = this.map.shadePoints[Math.floor(this.rng.next() * this.map.shadePoints.length)];
      this.drifters.push({
        id: this.allocId('D'),
        pos: [chosen[0], chosen[1] + 1.5, chosen[2]],
        state: 'idle',
        stolen: 0,
        hasStolen: false,
        stateTicksLeft: 0,
        idleAngle: this.rng.range(0, Math.PI * 2),
        spawnTick: this.simTick,
      });
    }
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: round3(this.wind.dirDeg) },
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        vel: [round3(this.player.vel[0]), round3(this.player.vel[1]), round3(this.player.vel[2])],
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.player.capacity,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCdTicks / TICK_RATE),
        charm_s: round3(this.player.charmTicks / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelUnits / FUEL_UNIT_SCALE) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: [round3(s.pos[0]), round3(s.pos[1]), round3(s.pos[2])],
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: [round3(m.pos[0]), round3(m.pos[1]), round3(m.pos[2])],
        kind: m.kind,
        ttl_s: m.ttlTicks !== null ? round3(m.ttlTicks / TICK_RATE) : null,
      })),
      drifters: this.drifters
        .filter((d) => d.state !== 'removed')
        .map((d) => ({
          id: d.id,
          pos: [round3(d.pos[0]), round3(d.pos[1]), round3(d.pos[2])],
          state: d.state as 'idle' | 'chase' | 'flee',
          stolen: d.stolen,
        })),
      charms: this.charms.map((c) => ({
        id: c.id,
        pos: [round3(c.pos[0]), round3(c.pos[1]), round3(c.pos[2])],
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE),
      })),
    };
  }

  getEndRecord(): EndRecord {
    return { type: 'end', ticks: this.tick, state: this.state, score: this.score };
  }
}
