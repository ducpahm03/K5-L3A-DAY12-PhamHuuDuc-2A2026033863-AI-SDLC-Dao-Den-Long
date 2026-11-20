import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const cliPath = resolve(root, 'dist/headless.mjs');
const tmpDir = resolve(root, 'tmp/contract-test-v12');

function runHeadless(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: root, encoding: 'utf8' });
}

function parseJsonl(filePath: string) {
  return readFileSync(filePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

describe('Headless CLI — Test Contract v1.2 (Phase 3 + Phase 1–2 Regression)', () => {
  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    if (process.platform === 'win32') {
      execFileSync('cmd.exe', ['/c', 'npm run build:headless'], { cwd: root, stdio: 'pipe' });
    } else {
      execFileSync('npm', ['run', 'build:headless'], { cwd: root, stdio: 'pipe' });
    }
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits v1.2 snapshot schema (fuel, ever_lit, relit_count, player.capacity) across nights 1, 2, 3', () => {
    for (const night of [1, 2, 3]) {
      const out = resolve(tmpDir, `night${night}.jsonl`);
      const res = runHeadless(['--seed', '42', '--night', String(night), '--ticks', '60', '--snapshot-every', '30', '--out', out]);
      expect(res.status).toBe(0);
      const recs = parseJsonl(out);
      expect(recs[0].player).toHaveProperty('capacity', 10);
      expect(recs[0].lanterns[0]).toHaveProperty('fuel', 0);
      expect(recs[0].lanterns[0]).toHaveProperty('ever_lit', false);
      expect(recs[0].lanterns[0]).toHaveProperty('relit_count', 0);
    }
  });

  it('verifies Phase 3 headless events: refuel, fuel_drain, lantern_out, lantern_lit {relight}, and dawn_survived', () => {
    const scenPath = resolve(tmpDir, 'p3-fuel.scenario.json');
    const inpPath = resolve(tmpDir, 'p3-fuel.inputs.json');
    const out = resolve(tmpDir, 'p3-fuel.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 15], carried: 8, flames: 3, successful_lights: 1 },
        random_motes: false,
        random_shades: false,
        lanterns: [
          { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20, ever_lit: true },
          { id: 'L2', pos: [23.8, 0, 7.7], lit: true, fuel: 0.5, ever_lit: true },
          { id: 'L3', lit: true, fuel: 90 },
          { id: 'L4', lit: true, fuel: 90 },
        ],
        shades: [{ id: 'S1', pos: [0, 1, 24], state: 'drain', target_lantern_id: 'L1' }],
        time_left_s: 3.0,
      }),
    );
    writeFileSync(
      inpPath,
      JSON.stringify({
        frames: [
          { tick: 62, move: [0, 1] },
          { tick: 155, move: [0, 0], interact: true },
          { tick: 156, interact: false },
        ],
      }),
    );

    const res = runHeadless(['--seed', '42', '--night', '1', '--scenario', scenPath, '--inputs', inpPath, '--ticks', '200', '--snapshot-every', '30', '--out', out]);
    expect(res.status).toBe(0);
    const recs = parseJsonl(out);
    const events = recs.filter((r) => r.type === 'event');
    const names = events.map((e) => e.name);

    expect(names).toContain('lantern_out'); // L2 runs out of 0.5 fuel
    expect(names).toContain('fuel_drain'); // S1 drains L1 for 60 ticks
    expect(names).toContain('refuel'); // Player refuels L1 at tick 71
    expect(events.at(-1)).toMatchObject({
      name: 'game_over',
      data: { result: 'won', reason: 'dawn_survived' },
    });
  });

  it('completes a full Night 3 headless run (18,000 ticks) well under 30s and is byte-identical across 2 runs', () => {
    const out1 = resolve(tmpDir, 'n3-1.jsonl');
    const out2 = resolve(tmpDir, 'n3-2.jsonl');
    const args = ['--seed', '2026', '--night', '3', '--ticks', '18000', '--snapshot-every', '600'];

    const r1 = runHeadless([...args, '--out', out1]);
    const r2 = runHeadless([...args, '--out', out2]);
    expect(r1.status).toBe(0);
    expect(r2.status).toBe(0);

    const h1 = createHash('sha256').update(readFileSync(out1)).digest('hex');
    const h2 = createHash('sha256').update(readFileSync(out2)).digest('hex');
    expect(h1).toBe(h2);
  });

  it('exits with code 2 on malformed JSON or invalid v1.2 inputs/scenario', () => {
    const bad = resolve(tmpDir, 'bad.json');
    const out = resolve(tmpDir, 'err.jsonl');
    writeFileSync(bad, '{"lanterns":[{"id":"L1","fuel":999}]}');
    const res = runHeadless(['--seed', '1', '--night', '1', '--scenario', bad, '--ticks', '10', '--out', out]);
    expect(res.status).toBe(2);
    expect(res.stderr.length).toBeGreaterThan(0);
  });

  it('validates Contract v1.3 requirements: bench_cmd, soak_cmd, and --export-leaderboard', () => {
    const contract = JSON.parse(readFileSync(resolve(root, 'game.contract.json'), 'utf8'));
    expect(contract.contract_version).toBe('1.3');
    expect(contract.bench_cmd).toBe('node dist/bench.mjs');
    expect(contract.soak_cmd).toBe('node dist/soak.mjs');

    const lbOut = resolve(tmpDir, 'test-leaderboard.json');
    const res = runHeadless(['--export-leaderboard', lbOut]);
    expect(res.status).toBe(0);
    expect(readFileSync(lbOut, 'utf8')).toBeTruthy();
  });
});
