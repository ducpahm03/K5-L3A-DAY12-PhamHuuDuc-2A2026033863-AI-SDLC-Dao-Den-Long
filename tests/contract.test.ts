import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const cliPath = resolve(root, 'dist/headless.mjs');
const tmpDir = resolve(root, 'tmp/contract-test');

function runHeadless(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function parseJsonl(filePath: string) {
  const lines = readFileSync(filePath, 'utf8').trim().split('\n');
  return lines.map((line) => JSON.parse(line));
}

describe('Headless CLI — Test Contract v1.0', () => {
  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    // Ensure headless bundle exists
    if (process.platform === 'win32') {
      execFileSync('cmd.exe', ['/c', 'npm run build:headless'], { cwd: root, stdio: 'pipe' });
    } else {
      execFileSync('npm', ['run', 'build:headless'], { cwd: root, stdio: 'pipe' });
    }
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits valid JSONL starting with tick 0 snapshot and ending with end record', () => {
    const out = resolve(tmpDir, 'basic.jsonl');
    const res = runHeadless(['--seed', '42', '--night', '1', '--ticks', '30', '--snapshot-every', '10', '--out', out]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    expect(records[0]).toMatchObject({ type: 'snapshot', tick: 0, sim_tick: 0, state: 'playing' });
    expect(records[0].lanterns).toHaveLength(5);
    expect(records[0].player.pos).toEqual([0, 0, 0]);
    expect(records.at(-1)).toMatchObject({ type: 'end', ticks: 30, state: 'playing' });

    const snapshots = records.filter((r) => r.type === 'snapshot');
    expect(snapshots.map((s) => s.tick)).toEqual([0, 10, 20, 30]);
  });

  it('completes a full win scenario via CLI with exact event sequence', () => {
    const scenarioPath = resolve(tmpDir, 'win-scenario.json');
    const inputsPath = resolve(tmpDir, 'win-inputs.json');
    const out = resolve(tmpDir, 'win.jsonl');

    writeFileSync(
      scenarioPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [
          [0, 0, 2],
          [0, 0, 4],
          [0, 0, 6],
        ],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 8], deposited: 0 },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 120,
      }),
    );

    writeFileSync(
      inputsPath,
      JSON.stringify({
        frames: [
          { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
          { tick: 65, move: [0, 0], interact: true },
          { tick: 66, interact: false },
        ],
      }),
    );

    const res = runHeadless([
      '--seed',
      '99',
      '--night',
      '1',
      '--scenario',
      scenarioPath,
      '--inputs',
      inputsPath,
      '--ticks',
      '300',
      '--out',
      out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const eventNames = records.filter((r) => r.type === 'event').map((r) => r.name);
    expect(eventNames).toEqual([
      'mote_picked',
      'mote_picked',
      'mote_picked',
      'deposit',
      'lantern_lit',
      'game_over',
    ]);
    expect(records.at(-1)).toMatchObject({ type: 'end', ticks: 66, state: 'won' });
  });

  it('is byte-for-byte deterministic across two runs with the same seed', () => {
    const out1 = resolve(tmpDir, 'det1.jsonl');
    const out2 = resolve(tmpDir, 'det2.jsonl');
    const args = ['--seed', '777', '--night', '1', '--ticks', '600', '--snapshot-every', '20'];

    expect(runHeadless([...args, '--out', out1]).status).toBe(0);
    expect(runHeadless([...args, '--out', out2]).status).toBe(0);

    const h1 = createHash('sha256').update(readFileSync(out1)).digest('hex');
    const h2 = createHash('sha256').update(readFileSync(out2)).digest('hex');
    expect(h1).toBe(h2);
  });

  it('exits with code 2 on malformed JSON or invalid inputs/scenario schema', () => {
    const badJson = resolve(tmpDir, 'bad.json');
    const badInputs = resolve(tmpDir, 'bad-inputs.json');
    const out = resolve(tmpDir, 'err.jsonl');

    writeFileSync(badJson, '{not valid json');
    const res1 = runHeadless(['--seed', '1', '--night', '1', '--scenario', badJson, '--ticks', '10', '--out', out]);
    expect(res1.status).toBe(2);
    expect(res1.stderr.length).toBeGreaterThan(0);

    writeFileSync(badInputs, JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] }));
    const res2 = runHeadless(['--seed', '1', '--night', '1', '--inputs', badInputs, '--ticks', '10', '--out', out]);
    expect(res2.status).toBe(2);
    expect(res2.stderr.length).toBeGreaterThan(0);
  });
});
