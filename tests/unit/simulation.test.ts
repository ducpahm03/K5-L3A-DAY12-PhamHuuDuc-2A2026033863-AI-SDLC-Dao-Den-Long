import { describe, expect, it } from 'vitest';
import { InputTimeline, Simulation, createDefaultInput } from '../../src/core/simulation.js';
import { TUNING, getDefaultNight1Lanterns } from '../../src/core/tuning.js';
import { ValidationError, validateInputsFile, validateScenarioSpec } from '../../src/core/validation.js';

describe('Core Simulation — Phase 1 (Test Contract v1.0)', () => {
  it('moves player accurately with cam_yaw_deg rotation and diagonal normalization', () => {
    const sim = new Simulation(1, { random_motes: false, random_shades: false });
    const timeline = new InputTimeline([
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 60, move: [0, 1], cam_yaw_deg: 90 },
      { tick: 120, move: [1, 1], cam_yaw_deg: 0 },
    ]);

    for (let k = 0; k < 60; k++) sim.step(timeline.atTick(k));
    expect(sim.getSnapshot().player.pos).toEqual([0, 0, 6]);

    for (let k = 60; k < 120; k++) sim.step(timeline.atTick(k));
    expect(sim.getSnapshot().player.pos).toEqual([6, 0, 6]);

    for (let k = 120; k < 180; k++) sim.step(timeline.atTick(k));
    const expectedDelta = 6 / Math.SQRT2;
    const pos = sim.getSnapshot().player.pos;
    expect(pos[0]).toBeCloseTo(6 + expectedDelta, 2);
    expect(pos[2]).toBeCloseTo(6 + expectedDelta, 2);
  });

  it('jumps on rising edge only and returns to ground Y=0', () => {
    const sim = new Simulation(2, { random_motes: false, random_shades: false });
    let maxY = 0;
    for (let k = 0; k < 60; k++) {
      sim.step({ ...createDefaultInput(), jump: true });
      maxY = Math.max(maxY, sim.player.pos[1]);
    }
    expect(maxY).toBeGreaterThan(1.0);
    expect(sim.getSnapshot().player.pos[1]).toBe(0);
  });

  it('picks up motes up to carry_capacity, deposits into lantern, and wins on 5th lit', () => {
    const sim = new Simulation(3, {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
        [0, 0, 4],
        [0, 0, 5],
        [0, 0, 6],
      ],
      lanterns: [
        { id: 'L1', pos: [0, 0, 8], deposited: 0 },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 100,
    });

    // Scenario setup emits nothing and grants 0 score
    expect(sim.score).toBe(0);
    expect(sim.getSnapshot().motes_active).toBe(6);

    const events = [];
    for (let k = 0; k < 70; k++) {
      events.push(...sim.step({ ...createDefaultInput(), move: [0, 1] }));
    }
    // Should cap at carry_capacity = 5
    expect(sim.player.carried).toBe(TUNING.carry_capacity);
    expect(sim.motes.length).toBe(1);
    expect(events.filter((e) => e.name === 'mote_picked')).toHaveLength(5);

    // Interact near L1 (player is around z=7, L1 at z=8, within interact_radius 2.5)
    const interactEvents = sim.step({ ...createDefaultInput(), interact: true });
    expect(interactEvents.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(sim.state).toBe('won');
    expect(sim.player.carried).toBe(2); // 5 - 3
    // Score: 5*10 + 200 + floor(98.817)*5 + 3*100 = 50 + 200 + 490 + 300 = 1040
    expect(sim.score).toBe(50 + 200 + Math.floor(sim.timeLeftS) * 5 + 3 * 100);
  });

  it('pulses to push and stun shades, respects cooldown and cost', () => {
    const sim = new Simulation(4, {
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 1, 5] }],
    });

    const ev1 = sim.step({ ...createDefaultInput(), pulse: true });
    expect(ev1.some((e) => e.name === 'pulse')).toBe(true);
    const pulseEv = ev1.find((e) => e.name === 'pulse')!;
    expect(pulseEv.data).toEqual({ stunned_ids: ['S1'] });
    expect(sim.player.carried).toBe(1);
    expect(sim.shades[0].state).toBe('stunned');
    expect(sim.shades[0].pos[2]).toBeCloseTo(9, 2);
    expect(sim.score).toBe(TUNING.score.per_stun);

    // Second pulse during cooldown does not trigger
    sim.step({ ...createDefaultInput(), pulse: false });
    const ev2 = sim.step({ ...createDefaultInput(), pulse: true });
    expect(ev2.some((e) => e.name === 'pulse')).toBe(false);
    expect(sim.player.carried).toBe(1);
  });

  it('shade chases, hits player with invuln & drop ratio, and loses on 0 flames', () => {
    const sim = new Simulation(5, {
      player: { pos: [0, 0, 0], carried: 5, flames: 2 },
      random_motes: false,
      random_shades: false,
      shades: [{ id: 'S1', pos: [0, 1, 1.5] }],
    });

    const allEvents = [];
    for (let k = 0; k < 200 && sim.state === 'playing'; k++) {
      allEvents.push(...sim.step(createDefaultInput()));
    }

    const hits = allEvents.filter((e) => e.name === 'player_hit');
    expect(hits).toHaveLength(2);
    expect(hits[0].data).toEqual({ by: 'shade', flames: 1, dropped: 2 });
    expect(hits[1].data).toEqual({ by: 'shade', flames: 0, dropped: 1 });
    // Second hit must occur at least invuln_s (90 ticks) after first
    expect(hits[1].tick - hits[0].tick).toBeGreaterThanOrEqual(90);
    expect(sim.state).toBe('lost');
    expect(allEvents.at(-1)).toMatchObject({
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });
  });

  it('enforces safe_radius around lit lanterns', () => {
    const sim = new Simulation(6, {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [0, 1, 10] }],
    });

    for (let k = 0; k < 300; k++) {
      sim.step(createDefaultInput());
      const s = sim.shades[0];
      const dist = Math.hypot(s.pos[0], s.pos[2]);
      expect(dist).toBeGreaterThanOrEqual(TUNING.safe_radius - 1e-6);
    }
    expect(sim.player.flames).toBe(3);
  });

  it('loses by dawn when time_left_s reaches 0', () => {
    const sim = new Simulation(7, {
      random_motes: false,
      random_shades: false,
      time_left_s: 1,
    });
    const events = [];
    for (let k = 0; k < 100 && sim.state === 'playing'; k++) {
      events.push(...sim.step(createDefaultInput()));
    }
    expect(sim.state).toBe('lost');
    expect(sim.tick).toBe(60);
    expect(events.at(-1)).toMatchObject({
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });
  });

  it('rejects invalid inputs and scenarios with ValidationError', () => {
    const validIds = new Set(getDefaultNight1Lanterns().map((l) => l.id));
    expect(() =>
      validateInputsFile({ frames: [{ tick: 10 }, { tick: 10 }] }),
    ).toThrow(ValidationError);
    expect(() =>
      validateInputsFile({ frames: [{ tick: 0, move: [2, 0] }] }),
    ).toThrow(ValidationError);
    expect(() =>
      validateScenarioSpec({ lanterns: [{ id: 'L99', lit: true }] }, validIds),
    ).toThrow(ValidationError);
  });
});
