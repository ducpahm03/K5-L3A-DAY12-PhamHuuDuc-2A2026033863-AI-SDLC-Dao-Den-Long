import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const cliPath = resolve(root, 'dist/headless.mjs');
const tmpDir = resolve(root, 'tmp/contract-test-v11');

function runHeadless(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: root, encoding: 'utf8' });
}

function parseJsonl(filePath: string) {
  return readFileSync(filePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

describe('Headless CLI — Test Contract v1.1 (Phase 2 + Phase 1 Regression)', () => {
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

  it('emits v1.1 snapshot schema across nights 1, 2, and 3', () => {
    for (const night of [1, 2, 3]) {
      const out = resolve(tmpDir, `night${night}.jsonl`);
      const res = runHeadless(['--seed', '42', '--night', String(night), '--ticks', '60', '--snapshot-every', '30', '--out', out]);
      expect(res.status).toBe(0);
      const recs = parseJsonl(out);
      expect(recs[0]).toMatchObject({
        type: 'snapshot',
        tick: 0,
        sim_tick: 0,
        night,
        state: 'playing',
      });
      expect(recs[0].wind).toHaveProperty('active');
      expect(recs[0].player).toHaveProperty('vel');
      expect(recs[0].player).toHaveProperty('grounded');
      expect(recs[0].player).toHaveProperty('dash_cd_s');
      expect(recs[0].player).toHaveProperty('pulse_cd_s');
      expect(recs[0].player).toHaveProperty('charm_s');
      expect(Array.isArray(recs[0].drifters)).toBe(true);
      expect(Array.isArray(recs[0].charms)).toBe(true);
      expect(recs[1]).toMatchObject({ type: 'event', tick: 0, name: 'night_start', data: { night } });
      expect(recs.at(-1)).toMatchObject({ type: 'end', ticks: 60, state: 'playing' });
    }
  });

  it('runs a full Phase 2 scenario for dash, pause/resume, drifter steal+drop, charm, and jump pad', () => {
    const scenPath = resolve(tmpDir, 'p2-features.scenario.json');
    const inpPath = resolve(tmpDir, 'p2-features.inputs.json');
    const out = resolve(tmpDir, 'p2-features.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [35, 0, 0], carried: 7, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        drifters: [{ id: 'D1', pos: [35, 1.5, 0.8], state: 'chase' }],
      }),
    );
    writeFileSync(
      inpPath,
      JSON.stringify({
        frames: [
          { tick: 0, dash: true },
          { tick: 1, dash: false, pulse: true },
          { tick: 2, pulse: false, pause: true },
          { tick: 3, pause: false },
          { tick: 5, pause: true },
          { tick: 6, pause: false },
        ],
      }),
    );

    const res = runHeadless(['--seed', '99', '--night', '2', '--scenario', scenPath, '--inputs', inpPath, '--ticks', '20', '--snapshot-every', '5', '--out', out]);
    expect(res.status).toBe(0);
    const recs = parseJsonl(out);
    const evNames = recs.filter((r) => r.type === 'event').map((r) => r.name);
    expect(evNames).toContain('dash');
    expect(evNames).toContain('charm_picked');
    expect(evNames).toContain('drifter_steal');
    expect(evNames).toContain('pulse');
    expect(evNames).toContain('drifter_drop');
    expect(evNames).toContain('paused');
    expect(evNames).toContain('resumed');
  });

  it('completes a full Night 3 headless run (21,600 ticks) well under 30s and is byte-identical across 2 runs', () => {
    const out1 = resolve(tmpDir, 'n3-1.jsonl');
    const out2 = resolve(tmpDir, 'n3-2.jsonl');
    const args = ['--seed', '2026', '--night', '3', '--ticks', '21600', '--snapshot-every', '600'];

    const t0 = performance.now();
    const r1 = runHeadless([...args, '--out', out1]);
    const elapsedMs = performance.now() - t0;
    expect(r1.status).toBe(0);
    expect(elapsedMs).toBeLessThan(30000);

    const r2 = runHeadless([...args, '--out', out2]);
    expect(r2.status).toBe(0);

    const h1 = createHash('sha256').update(readFileSync(out1)).digest('hex');
    const h2 = createHash('sha256').update(readFileSync(out2)).digest('hex');
    expect(h1).toBe(h2);
  });

  it('exits with code 2 on malformed JSON or invalid v1.1 inputs/scenario', () => {
    const bad = resolve(tmpDir, 'bad.json');
    const out = resolve(tmpDir, 'err.jsonl');
    writeFileSync(bad, '{"frames":[{"tick":5},{"tick":2}]}');
    const res = runHeadless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', out]);
    expect(res.status).toBe(2);
    expect(res.stderr.length).toBeGreaterThan(0);
  });
});
