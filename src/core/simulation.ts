import { distXZ, round3, SeededRng } from './rng.js';
import {
  DT,
  GRAVITY,
  INITIAL_RANDOM_MOTES,
  INITIAL_RANDOM_SHADES,
  ISLAND_RADIUS,
  JUMP_VELOCITY,
  MAX_RANDOM_SHADES,
  MIN_RANDOM_MOTES,
  MOTE_SPAWN_INTERVAL_TICKS,
  SHADE_DEFAULT_Y,
  SHADE_SPAWN_INTERVAL_TICKS,
  TICK_RATE,
  TUNING,
  getDefaultNight1Lanterns,
} from './tuning.js';
import type {
  EndRecord,
  EventName,
  EventRecord,
  GameState,
  InputFrame,
  LanternEntity,
  MoteEntity,
  PlayerState,
  ResolvedInput,
  ScenarioSpec,
  ShadeEntity,
  SnapshotRecord,
  Vec3,
} from './types.js';

export function createDefaultInput(): ResolvedInput {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
  };
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
      this.cursor++;
    }
    return {
      move: [this.current.move[0], this.current.move[1]],
      cam_yaw_deg: this.current.cam_yaw_deg,
      jump: this.current.jump,
      interact: this.current.interact,
      pulse: this.current.pulse,
      dash: this.current.dash,
    };
  }
}

function clampToIsland(pos: Vec3): void {
  const r = Math.hypot(pos[0], pos[2]);
  if (r > ISLAND_RADIUS) {
    const scale = ISLAND_RADIUS / r;
    pos[0] *= scale;
    pos[2] *= scale;
  }
}

export class Simulation {
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

  private readonly rng: SeededRng;
  private readonly randomMotes: boolean;
  private readonly randomShades: boolean;
  private nextMoteNum = 1;
  private nextShadeNum = 1;
  private readonly usedShadeIds = new Set<string>();
  private readonly usedMoteIds = new Set<string>();
  private prevInput: ResolvedInput = createDefaultInput();

  constructor(seed: number, scenario?: ScenarioSpec) {
    this.rng = new SeededRng(seed);
    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.startTimeS = scenario?.time_left_s ?? TUNING.night1_duration_s;
    this.timeLeftS = round3(this.startTimeS);

    this.player = {
      pos: scenario?.player?.pos ? [...scenario.player.pos] : [0, 0, 0],
      velY: 0,
      flames: scenario?.player?.flames ?? TUNING.flames,
      carried: scenario?.player?.carried ?? 0,
      invulnTimer: 0,
      pulseCooldown: 0,
    };

    this.lanterns = getDefaultNight1Lanterns().map((d) => ({
      id: d.id,
      pos: [...d.pos],
      lit: false,
      deposited: 0,
    }));

    if (scenario?.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) target.pos = [patch.pos[0], 0, patch.pos[2]];
        if (patch.deposited !== undefined) target.deposited = patch.deposited;
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit && patch.deposited === undefined) {
            target.deposited = Math.max(target.deposited, TUNING.lantern_cost);
          }
        } else if (target.deposited >= TUNING.lantern_cost) {
          target.lit = true;
        }
      }
    }

    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        const pos: Vec3 = Array.isArray(m) ? [m[0], 0, m[2]] : [m.pos[0], 0, m.pos[2]];
        const explicitId = Array.isArray(m) ? undefined : m.id;
        const id = explicitId ?? this.allocMoteId();
        this.usedMoteIds.add(id);
        this.motes.push({ id, pos });
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < INITIAL_RANDOM_MOTES; i++) {
        this.spawnRandomMote();
      }
    }

    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? this.allocShadeId();
        this.usedShadeIds.add(id);
        const state = s.state ?? 'chase';
        this.shades.push({
          id,
          pos: [s.pos[0], s.pos[1], s.pos[2]],
          state,
          stunTimer: state === 'stunned' ? TUNING.pulse_stun_s : 0,
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < INITIAL_RANDOM_SHADES; i++) {
        this.spawnRandomShade(false);
      }
    }
  }

  private allocMoteId(): string {
    while (this.usedMoteIds.has(`M${this.nextMoteNum}`)) this.nextMoteNum++;
    const id = `M${this.nextMoteNum++}`;
    this.usedMoteIds.add(id);
    return id;
  }

  private allocShadeId(): string {
    while (this.usedShadeIds.has(`S${this.nextShadeNum}`)) this.nextShadeNum++;
    const id = `S${this.nextShadeNum++}`;
    this.usedShadeIds.add(id);
    return id;
  }

  private spawnRandomMote(): void {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = Math.sqrt(this.rng.next()) * (ISLAND_RADIUS - 4);
      const pos: Vec3 = [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)];
      if (distXZ(pos, this.player.pos) < TUNING.pickup_radius + 2.5) continue;
      if (this.lanterns.some((l) => distXZ(pos, l.pos) < 2.0)) continue;
      this.motes.push({ id: this.allocMoteId(), pos });
      return;
    }
    const fallbackAngle = this.rng.range(0, Math.PI * 2);
    this.motes.push({
      id: this.allocMoteId(),
      pos: [round3(Math.cos(fallbackAngle) * 14), 0, round3(Math.sin(fallbackAngle) * 14)],
    });
  }

  private spawnRandomShade(emitEvents: boolean, events?: EventRecord[], tickNum?: number): void {
    let chosen: Vec3 = [0, SHADE_DEFAULT_Y, -28];
    for (let attempt = 0; attempt < 32; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(24, ISLAND_RADIUS - 3);
      const candidate: Vec3 = [
        round3(Math.cos(angle) * radius),
        SHADE_DEFAULT_Y,
        round3(Math.sin(angle) * radius),
      ];
      if (distXZ(candidate, this.player.pos) < 10) continue;
      if (this.lanterns.some((l) => l.lit && distXZ(candidate, l.pos) < TUNING.safe_radius + 1)) continue;
      chosen = candidate;
      break;
    }
    const id = this.allocShadeId();
    this.shades.push({ id, pos: chosen, state: 'chase', stunTimer: 0 });
    if (emitEvents && events && tickNum !== undefined) {
      events.push({ type: 'event', tick: tickNum, name: 'shade_spawned', data: { id } });
    }
  }

  private pushOutOfSafeZones(pos: Vec3): boolean {
    let pushed = false;
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      const dx = pos[0] - lantern.pos[0];
      const dz = pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < TUNING.safe_radius) {
        const nx = d > 1e-9 ? dx / d : 0;
        const nz = d > 1e-9 ? dz / d : 1;
        const targetR = TUNING.safe_radius + 0.001;
        pos[0] = lantern.pos[0] + nx * targetR;
        pos[2] = lantern.pos[2] + nz * targetR;
        pushed = true;
      }
    }
    return pushed;
  }

  step(input: ResolvedInput): EventRecord[] {
    if (this.state !== 'playing') return [];

    const events: EventRecord[] = [];
    const nextTick = this.tick + 1;
    const emit = (name: EventName, data: Record<string, unknown>): void => {
      events.push({ type: 'event', tick: nextTick, name, data });
    };

    const jumpEdge = !this.prevInput.jump && input.jump;
    const interactEdge = !this.prevInput.interact && input.interact;
    const pulseEdge = !this.prevInput.pulse && input.pulse;
    this.prevInput = { ...input, move: [input.move[0], input.move[1]] };

    // 1. Timers
    this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer = Math.max(0, shade.stunTimer - DT);
        if (shade.stunTimer <= 1e-9) {
          shade.stunTimer = 0;
          shade.state = 'chase';
        }
      }
    }

    // 2. Player movement & jump
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
    this.player.pos[0] += wx * TUNING.player_speed * DT;
    this.player.pos[2] += wz * TUNING.player_speed * DT;
    clampToIsland(this.player.pos);

    if (jumpEdge && this.player.pos[1] <= 1e-9) {
      this.player.velY = JUMP_VELOCITY;
    }
    if (this.player.pos[1] > 0 || this.player.velY !== 0) {
      this.player.velY += GRAVITY * DT;
      this.player.pos[1] += this.player.velY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.velY = 0;
      }
    }

    // 3. Advance clock for tick k+1
    this.tick = nextTick;
    this.simTick = nextTick;
    this.timeLeftS = Math.max(0, round3(this.startTimeS - this.simTick / TICK_RATE));

    // 4. Auto-pickup motes
    for (let i = 0; i < this.motes.length; ) {
      if (this.player.carried >= TUNING.carry_capacity) break;
      if (distXZ(this.player.pos, this.motes[i].pos) <= TUNING.pickup_radius) {
        this.motes.splice(i, 1);
        this.player.carried += 1;
        this.score += TUNING.score.per_mote;
        emit('mote_picked', { carried: this.player.carried });
      } else {
        i++;
      }
    }

    // 5. Interact (deposit to nearest unlit lantern in interact_radius)
    if (interactEdge && this.player.carried > 0) {
      let best: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= TUNING.interact_radius && d < bestDist) {
          bestDist = d;
          best = lantern;
        }
      }
      if (best) {
        const needed = Math.max(0, TUNING.lantern_cost - best.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          best.deposited += amount;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= TUNING.lantern_cost) {
            best.lit = true;
            this.score += TUNING.score.per_lantern;
            emit('lantern_lit', { lantern_id: best.id });
            if (this.lanterns.every((l) => l.lit)) {
              this.score +=
                Math.floor(this.timeLeftS) * TUNING.score.per_second_left +
                this.player.flames * TUNING.score.per_flame_left;
              this.state = 'won';
              emit('game_over', { result: 'won', reason: 'all_lit' });
              return events;
            }
          }
        }
      }
    }

    // 6. Pulse
    if (pulseEdge && this.player.pulseCooldown <= 1e-9 && this.player.carried >= TUNING.pulse_cost) {
      this.player.carried -= TUNING.pulse_cost;
      this.player.pulseCooldown = TUNING.pulse_cooldown_s;
      const stunnedIds: string[] = [];
      for (const shade of this.shades) {
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= TUNING.pulse_radius) {
          const nx = d > 1e-9 ? dx / d : 0;
          const nz = d > 1e-9 ? dz / d : 1;
          shade.pos[0] += nx * TUNING.pulse_push_m;
          shade.pos[2] += nz * TUNING.pulse_push_m;
          this.pushOutOfSafeZones(shade.pos);
          clampToIsland(shade.pos);
          shade.state = 'stunned';
          shade.stunTimer = TUNING.pulse_stun_s;
          this.score += TUNING.score.per_stun;
          stunnedIds.push(shade.id);
        }
      }
      emit('pulse', { stunned_ids: stunnedIds });
    }

    // 7. Shades AI, safe zones, and player hit
    for (const shade of this.shades) {
      if (shade.state === 'stunned') continue;

      const wasInsideSafe = this.pushOutOfSafeZones(shade.pos);
      if (wasInsideSafe) {
        shade.state = 'flee';
      } else {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const d = Math.hypot(dx, dz);
        shade.state = 'chase';
        if (d > 1e-9) {
          const stepDist = Math.min(d, TUNING.shade_speed * DT);
          shade.pos[0] += (dx / d) * stepDist;
          shade.pos[2] += (dz / d) * stepDist;
        }
        clampToIsland(shade.pos);
        if (this.pushOutOfSafeZones(shade.pos)) {
          shade.state = 'flee';
        }
      }
      clampToIsland(shade.pos);
      this.pushOutOfSafeZones(shade.pos);

      if (this.player.invulnTimer <= 1e-9 && distXZ(this.player.pos, shade.pos) <= TUNING.shade_hit_radius) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
        this.player.carried -= dropped;
        this.player.invulnTimer = TUNING.invuln_s;
        emit('player_hit', { by: 'shade', flames: this.player.flames, dropped });
        if (this.player.flames <= 0) {
          this.state = 'lost';
          emit('game_over', { result: 'lost', reason: 'no_flames' });
          return events;
        }
      }
    }

    // 8. Periodic deterministic spawning
    if (this.randomMotes && this.motes.length < MIN_RANDOM_MOTES && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnRandomMote();
    }
    if (this.randomShades && this.shades.length < MAX_RANDOM_SHADES && this.simTick % SHADE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnRandomShade(true, events, nextTick);
    }

    // 9. Dawn timeout
    if (this.state === 'playing' && this.timeLeftS <= 0) {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }

    return events;
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: [round3(this.player.pos[0]), round3(this.player.pos[1]), round3(this.player.pos[2])],
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: [round3(l.pos[0]), round3(l.pos[1]), round3(l.pos[2])],
        lit: l.lit,
        deposited: l.deposited,
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
      })),
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
