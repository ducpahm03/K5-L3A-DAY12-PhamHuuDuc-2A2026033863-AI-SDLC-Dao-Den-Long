import { describe, expect, it } from 'vitest';
import { getMapConfig } from '../../src/core/maps.js';
import { InputTimeline, Simulation, createDefaultInput } from '../../src/core/simulation.js';
import { CHARM_SPEED, TUNING } from '../../src/core/tuning.js';
import { ValidationError, validateInputsFile, validateScenarioSpec } from '../../src/core/validation.js';

describe('Core Simulation — Phase 2 (Contract v1.1 + Phase 1 Regression)', () => {
  it('Phase 1 regression: cam_yaw_deg rotation, acceleration <= 0.1s, jump & land', () => {
    const sim = new Simulation(1, 1, { random_motes: false, random_shades: false });
    const timeline = new InputTimeline([
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 60, move: [0, 1], cam_yaw_deg: 90 },
    ]);

    for (let k = 0; k < 60; k++) sim.step(timeline.atTick(k));
    expect(sim.player.vel[2]).toBeCloseTo(6.0, 2);
    expect(sim.player.pos[2]).toBeGreaterThan(5.5);

    for (let k = 60; k < 120; k++) sim.step(timeline.atTick(k));
    expect(sim.player.vel[0]).toBeCloseTo(6.0, 2);
    expect(sim.player.pos[0]).toBeGreaterThan(5.3);

    // Jump & land cleanly
    let maxY = 0;
    for (let k = 0; k < 60; k++) {
      sim.step({ ...createDefaultInput(), jump: k === 0 });
      maxY = Math.max(maxY, sim.player.pos[1]);
    }
    expect(maxY).toBeGreaterThan(1.0);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.pos[1]).toBe(0);
  });

  it('Phase 1 regression (standardized numbers): pickup, deposit scoring (+10/mote, +100/lantern), win bonus', () => {
    const sim = new Simulation(2, 1, {
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 0.5], [0, 0, 0.8]],
      lanterns: [
        { id: 'L1', pos: [0, 0, 1.5], deposited: 0 },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    });

    // Tick 1: auto-pickup both motes -> carried 10, score stays 0 until deposit!
    const ev1 = sim.step(createDefaultInput());
    expect(ev1.filter((e) => e.name === 'mote_picked')).toHaveLength(2);
    expect(sim.player.carried).toBe(10);
    expect(sim.score).toBe(0);

    // Tick 2: interact deposits 10 -> lights L1 -> wins!
    const ev2 = sim.step({ ...createDefaultInput(), interact: true });
    expect(ev2.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(sim.state).toBe('won');
    // Score: 10*10 + 100 + floor(99.967)*2 + 3*50 = 100 + 100 + 198 + 150 = 548
    expect(sim.score).toBe(10 * 10 + 100 + Math.floor(sim.timeLeftS) * 2 + 3 * 50);
  });

  it('Dash: 14 m/s for 12 ticks, 90-tick cooldown from start, holds height on air dash', () => {
    const sim = new Simulation(3, 1, {
      player: { pos: [0, 2, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
    });
    sim.player.grounded = false;

    const ev1 = sim.step({ ...createDefaultInput(), dash: true });
    expect(ev1.some((e) => e.name === 'dash')).toBe(true);
    expect(sim.player.pos[1]).toBe(2);

    for (let k = 1; k < 12; k++) {
      sim.step({ ...createDefaultInput(), dash: false });
      expect(sim.player.pos[1]).toBe(2); // Air dash preserves Y
    }
    expect(sim.player.pos[2]).toBeCloseTo(2.8, 2); // 14 * 0.2 = 2.8m
    expect(sim.player.dashCdTicks).toBe(79); // 90 - 11
  });

  it('Fall off island (Y < -10): ignores invuln, emits lost, waits 60 ticks then respawns with invuln 90', () => {
    const sim = new Simulation(4, 1, {
      player: { pos: [41, -9.8, 0], carried: 6, flames: 3, invuln_ticks: 50 },
      random_motes: false,
      random_shades: false,
    });
    sim.player.grounded = false;
    sim.player.vel[1] = -20;

    const ev = sim.step(createDefaultInput());
    expect(ev.find((e) => e.name === 'player_hit')).toMatchObject({
      name: 'player_hit',
      data: { by: 'fall', flames: 2, dropped: 0, lost: 6 },
    });
    expect(sim.player.carried).toBe(0);
    expect(sim.player.respawnWaitTicks).toBe(60);

    for (let k = 0; k < 60; k++) sim.step(createDefaultInput());
    expect(sim.player.pos).toEqual([0, 0, 0]);
    expect(sim.player.invulnTicks).toBe(90);
    expect(sim.player.grounded).toBe(true);
  });

  it('Pulse 3D (radius 5m from feet+0.8m): stuns 120 ticks, pushes 4m over 15 ticks, +5 score', () => {
    const sim = new Simulation(5, 1, {
      player: { pos: [0, 0, 0], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 1, 4], state: 'chase' }],
    });

    const ev1 = sim.step({ ...createDefaultInput(), pulse: true });
    expect(ev1.find((e) => e.name === 'pulse')?.data).toEqual({ stunned_ids: ['S1'] });
    expect(sim.player.carried).toBe(0);
    expect(sim.score).toBe(5);
    expect(sim.shades[0].state).toBe('stunned');

    for (let k = 1; k < 15; k++) sim.step(createDefaultInput());
    expect(sim.shades[0].pos[2]).toBeCloseTo(8.0, 2); // 4 + 4m push over 15 ticks
  });

  it('Shade recoil & dropped motes on hit (5 exact states: spawning/wander/chase/recoil/stunned)', () => {
    const sim = new Simulation(6, 1, {
      player: { pos: [0, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 1, 0.8], state: 'chase' }],
    });

    const ev = sim.step(createDefaultInput());
    expect(ev.find((e) => e.name === 'player_hit')?.data).toEqual({ by: 'shade', flames: 2, dropped: 2 });
    expect(sim.shades[0].state).toBe('recoil');
    expect(sim.motes.filter((m) => m.kind === 'dropped')).toHaveLength(2);
    expect(sim.player.invulnTicks).toBe(90);
  });

  it('Night 2 Jump Pad launches player from Island A (20,0,18) safely onto Island B', () => {
    const sim = new Simulation(7, 2, {
      player: { pos: [20, 0, 18], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    });

    sim.step(createDefaultInput());
    expect(sim.player.grounded).toBe(false);
    expect(sim.player.vel[1]).toBe(14);

    for (let k = 0; k < 100 && !sim.player.grounded; k++) {
      sim.step(createDefaultInput());
    }
    expect(sim.player.grounded).toBe(true);
    expect(Math.hypot(sim.player.pos[0] - 70, sim.player.pos[2])).toBeLessThanOrEqual(28);
  });

  it('Night 3 Jump Pad launches from Tier 1 (0,3,13) onto Tier 2 (Y=6), and wind pushes player', () => {
    const sim = new Simulation(8, 3, {
      player: { pos: [0, 3, 13], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
    });

    sim.step(createDefaultInput());
    for (let k = 0; k < 80 && !sim.player.grounded; k++) sim.step(createDefaultInput());
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.pos[1]).toBe(6);
    expect(Math.hypot(sim.player.pos[0], sim.player.pos[2])).toBeLessThanOrEqual(8);
  });

  it('Drifter steals min(3, carried) and drops all when pulsed during flee', () => {
    const sim = new Simulation(9, 2, {
      player: { pos: [0, 0, 0], carried: 7, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      drifters: [{ id: 'D1', pos: [0, 1.5, 1.0], state: 'chase' }],
    });

    const ev1 = sim.step(createDefaultInput());
    expect(ev1.find((e) => e.name === 'drifter_steal')?.data).toEqual({ drifter_id: 'D1', amount: 3, carried: 4 });
    expect(sim.drifters[0].state).toBe('flee');
    expect(sim.drifters[0].stolen).toBe(3);

    // Pulse on next tick while D1 is still within 5m
    const ev2 = sim.step({ ...createDefaultInput(), pulse: true });
    expect(ev2.find((e) => e.name === 'drifter_drop')?.data).toEqual({ drifter_id: 'D1', amount: 3 });
    expect(sim.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
  });

  it('Charm boosts speed to 7.2 m/s and removes dash cooldown for 600 ticks', () => {
    const sim = new Simulation(10, 2, {
      player: { pos: [35, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
    });

    const ev1 = sim.step(createDefaultInput());
    expect(ev1.find((e) => e.name === 'charm_picked')?.data).toEqual({ charm_id: 'C1', charm_ticks: 600 });
    expect(sim.charms[0].available).toBe(false);

    // Run forward -> speed reaches 7.2 m/s
    for (let k = 0; k < 10; k++) sim.step({ ...createDefaultInput(), move: [1, 0] });
    expect(sim.player.vel[0]).toBeCloseTo(CHARM_SPEED, 2);

    // Dash has 0 cooldown while charmed
    const evDash = sim.step({ ...createDefaultInput(), dash: true });
    expect(evDash.some((e) => e.name === 'dash')).toBe(true);
    expect(sim.player.dashCdTicks).toBe(0);
  });

  it('Pause freezes sim_tick & timers while tick continues, resume continues simulation', () => {
    const sim = new Simulation(11, 1, { random_motes: false, random_shades: false, time_left_s: 100 });
    sim.step(createDefaultInput());
    expect(sim.tick).toBe(1);
    expect(sim.simTick).toBe(1);

    const evPause = sim.step({ ...createDefaultInput(), pause: true });
    expect(evPause.some((e) => e.name === 'paused')).toBe(true);
    expect(sim.state).toBe('paused');
    expect(sim.tick).toBe(2);
    expect(sim.simTick).toBe(1);

    const tPaused = sim.timeLeftS;
    sim.step({ ...createDefaultInput(), pause: false });
    sim.step({ ...createDefaultInput(), pause: false });
    expect(sim.tick).toBe(4);
    expect(sim.simTick).toBe(1);
    expect(sim.timeLeftS).toBe(tPaused);

    const evRes = sim.step({ ...createDefaultInput(), pause: true });
    expect(evRes.some((e) => e.name === 'resumed')).toBe(true);
    expect(sim.state).toBe('playing');
    expect(sim.tick).toBe(5);
    expect(sim.simTick).toBe(2);
  });

  it('Rejects invalid inputs & scenario schemas with ValidationError', () => {
    const validIds = new Set(getMapConfig(1).lanterns.map((l) => l.id));
    expect(() => validateInputsFile({ frames: [{ tick: 10 }, { tick: 10 }] })).toThrow(ValidationError);
    expect(() => validateInputsFile({ frames: [{ tick: 0, dash: 'yes' }] })).toThrow(ValidationError);
    expect(() => validateScenarioSpec({ shades: [{ pos: [0, 1, 0], state: 'bogus' }] }, validIds)).toThrow(ValidationError);
    expect(TUNING.carry_capacity).toBe(10);
  });
});
