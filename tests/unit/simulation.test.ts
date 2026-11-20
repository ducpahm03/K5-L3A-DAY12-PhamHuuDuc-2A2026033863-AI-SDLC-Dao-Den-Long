import { describe, expect, it } from 'vitest';
import { getMapConfig } from '../../src/core/maps.js';
import { InputTimeline, Simulation, createDefaultInput } from '../../src/core/simulation.js';
import { CHARM_SPEED, TUNING } from '../../src/core/tuning.js';
import { ValidationError, validateInputsFile, validateScenarioSpec } from '../../src/core/validation.js';

describe('Core Simulation — Phase 3 (Contract v1.2 + Phase 1–2 Non-Replaced Regression)', () => {
  it('Phase 1–2 regression: cam_yaw_deg rotation, acceleration <= 0.1s, jump & land', () => {
    const sim = new Simulation(1, 1, { random_motes: false, random_shades: false });
    const timeline = new InputTimeline([
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 60, move: [0, 1], cam_yaw_deg: 90 },
    ]);

    for (let k = 0; k < 60; k++) sim.step(timeline.atTick(k));
    expect(sim.player.vel[2]).toBeCloseTo(6.0, 2);

    for (let k = 60; k < 120; k++) sim.step(timeline.atTick(k));
    expect(sim.player.vel[0]).toBeCloseTo(6.0, 2);

    let maxY = 0;
    for (let k = 0; k < 60; k++) {
      sim.step({ ...createDefaultInput(), jump: k === 0 });
      maxY = Math.max(maxY, sim.player.pos[1]);
    }
    expect(maxY).toBeGreaterThan(1.0);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.pos[1]).toBe(0);
  });

  /**
   * [UPDATED IN PHASE 3 — Reason documented in ADR-001]:
   * Old Phase 1–2 test expected immediate win (`all_lit`) on lighting 5th lantern and `+10` per deposited mote.
   * Ticket-03 replaces `all_lit` with `dawn_survived` (`>= ceil(0.6 * total)` lit at dawn), changes mote deposit score to `+5`,
   * adds lamp fuel (`100`, `-1/s`), progressive capacity (`10 + 2 * successful_lights`, max 20), `lantern_out`, `relight` (cost 5, `+40`), and `refuel`.
   */
  it('Phase 3 fuel lifecycle: first light (+100, fuel=100, capacity+2), decay to lantern_out, relight (cost 5, +40), and refuel', () => {
    const sim = new Simulation(2, 1, {
      player: { pos: [0, 0, 24], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false }],
      time_left_s: 200,
    });

    // 1. Light L1 for the first time (cost 10)
    const ev1 = sim.step({ ...createDefaultInput(), interact: true });
    expect(ev1.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    expect(ev1[1].data).toEqual({ lantern_id: 'L1', relight: false });
    expect(sim.score).toBe(10 * 5 + 100); // 150
    expect(sim.player.capacity).toBe(12); // 10 + 2 * 1
    expect(sim.getSnapshot().lanterns[0].fuel).toBe(100);
    expect(sim.state).toBe('playing'); // No early win!

    // 2. Give player 3 motes, let L1 decay for 900 ticks (15s -> fuel = 85), then refuel (needs ceil(15/10) = 2 motes -> fuel = 100)
    sim.player.carried = 3;
    for (let k = 0; k < 900; k++) sim.step(createDefaultInput());
    expect(sim.getSnapshot().lanterns[0].fuel).toBe(85);

    const evRefuel = sim.step({ ...createDefaultInput(), interact: true });
    expect(evRefuel.find((e) => e.name === 'refuel')?.data).toEqual({
      lantern_id: 'L1',
      amount: 2,
      fuel: 100,
    });
    expect(sim.player.carried).toBe(1);
    expect(sim.score).toBe(150 + 2 * 5); // 160

    // 3. Force L1 near empty (2 units = 2/60 fuel) -> decays to 0 -> emits lantern_out -> relight costs 5!
    sim.lanterns[0].fuelUnits = 2;
    sim.step(createDefaultInput());
    const evOut = sim.step(createDefaultInput());
    expect(evOut.find((e) => e.name === 'lantern_out')?.data).toEqual({ lantern_id: 'L1' });
    expect(sim.lanterns[0].lit).toBe(false);
    expect(sim.lanterns[0].everLit).toBe(true);

    sim.player.carried = 6;
    const evRelight = sim.step({ ...createDefaultInput(), interact: true });
    expect(evRelight.find((e) => e.name === 'lantern_lit')?.data).toEqual({
      lantern_id: 'L1',
      relight: true,
    });
    expect(sim.player.carried).toBe(1); // Only used 5 motes!
    expect(sim.player.capacity).toBe(14); // 10 + 2 * 2
    expect(sim.score).toBe(160 + 5 * 5 + 40); // 225
  });

  /**
   * [UPDATED IN PHASE 3 — Reason documented in ADR-001]:
   * Old Phase 1–2 test checked that shades NEVER enter `safe_radius = 6m` of any lit lantern.
   * Ticket-03 specifies that lanterns with `fuel >= 30` keep their `6m` safe zone, while lanterns with `fuel < 30`
   * lose their safe zone and attract `wander` shades into `state = "drain"` at `<= 2m` (`5 fuel/s`, `fuel_drain` every 60 ticks),
   * and pulsing a draining shade grants `+15` score.
   */
  it('Phase 3 shade drain & safe zone threshold (fuel >= 30 blocks at 6m; fuel < 30 drained at <= 2m; pulse drain +15)', () => {
    const sim = new Simulation(3, 1, {
      player: { pos: [0, 0, -25], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: 'S1', pos: [0, 1, 21], state: 'wander' }],
      time_left_s: 200,
    });

    // S1 walks from z=21 to z>=23 (<= 2m from L1 at z=25) and enters drain state
    const events = [];
    for (let k = 0; k < 120; k++) {
      events.push(...sim.step(createDefaultInput()));
    }
    expect(sim.shades[0].state).toBe('drain');
    const drainEv = events.find((e) => e.name === 'fuel_drain');
    expect(drainEv).toBeDefined();
    expect(drainEv?.data.lantern_id).toBe('L1');

    // Move player within 3m of draining S1 and pulse -> +15 score!
    sim.player.pos = [0, 0, 22];
    const evPulse = sim.step({ ...createDefaultInput(), pulse: true });
    expect(evPulse.find((e) => e.name === 'pulse')?.data).toEqual({ stunned_ids: ['S1'] });
    expect(sim.score).toBe(15);
    expect(sim.shades[0].state).toBe('stunned');
  });

  it('Phase 3 dawn_survived win vs dawn loss based on ceil(0.6 * total) lit lanterns', () => {
    // Night 1 requires ceil(0.6 * 5) = 3 lit lanterns at dawn
    const simWin = new Simulation(4, 1, {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', lit: true, fuel: 80 },
        { id: 'L2', lit: true, fuel: 60 },
        { id: 'L3', lit: true, fuel: 40 },
        { id: 'L4', lit: false },
        { id: 'L5', lit: false },
      ],
      time_left_s: 0.5,
    });

    const evWin = [];
    for (let k = 0; k < 40 && simWin.state === 'playing'; k++) {
      evWin.push(...simWin.step(createDefaultInput()));
    }
    expect(simWin.state).toBe('won');
    expect(evWin.at(-1)?.data).toEqual({ result: 'won', reason: 'dawn_survived' });
    // Dawn bonus: 3 lanterns * 50 + floor(79.5)+floor(59.5)+floor(39.5) + 3 flames * 50 = 150 + (79+59+39) + 150 = 477
    expect(simWin.score).toBe(150 + 79 + 59 + 39 + 150);

    // Only 2/5 lit at dawn -> loses with reason: "dawn"
    const simLose = new Simulation(5, 1, {
      random_motes: false,
      random_shades: false,
      lanterns: [
        { id: 'L1', lit: true, fuel: 80 },
        { id: 'L2', lit: true, fuel: 60 },
      ],
      time_left_s: 0.5,
    });
    const evLose = [];
    for (let k = 0; k < 40 && simLose.state === 'playing'; k++) {
      evLose.push(...simLose.step(createDefaultInput()));
    }
    expect(simLose.state).toBe('lost');
    expect(evLose.at(-1)?.data).toEqual({ result: 'lost', reason: 'dawn' });
  });

  it('Phase 2 regression: Dash, Fall respawn, Jump Pads, Drifter steal+drop, Charm, and Pause', () => {
    const sim = new Simulation(6, 2, {
      player: { pos: [35, 0, 0], carried: 7, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: 'D1', pos: [35, 1.5, 0.8], state: 'chase' }],
    });

    const ev1 = sim.step({ ...createDefaultInput(), dash: true });
    expect(ev1.some((e) => e.name === 'dash')).toBe(true);
    expect(ev1.some((e) => e.name === 'charm_picked')).toBe(true);
    expect(ev1.some((e) => e.name === 'drifter_steal')).toBe(true);
    expect(sim.player.dashCdTicks).toBe(0); // Charmed -> 0 dash cooldown!

    const ev2 = sim.step({ ...createDefaultInput(), pulse: true });
    expect(ev2.some((e) => e.name === 'drifter_drop')).toBe(true);

    const evPause = sim.step({ ...createDefaultInput(), pause: true });
    expect(evPause.some((e) => e.name === 'paused')).toBe(true);
    expect(sim.state).toBe('paused');

    sim.step({ ...createDefaultInput(), pause: false });
    const evResume = sim.step({ ...createDefaultInput(), pause: true });
    expect(evResume.some((e) => e.name === 'resumed')).toBe(true);
    expect(sim.state).toBe('playing');
    expect(CHARM_SPEED).toBe(7.2);
    expect(TUNING.fuel_max).toBe(100);
  });

  it('Rejects invalid v1.2 inputs & scenario schemas with ValidationError', () => {
    const validIds = new Set(getMapConfig(1).lanterns.map((l) => l.id));
    expect(() => validateInputsFile({ frames: [{ tick: 10 }, { tick: 10 }] })).toThrow(ValidationError);
    expect(() => validateScenarioSpec({ lanterns: [{ id: 'L1', fuel: 150 }] }, validIds)).toThrow(ValidationError);
  });
});
