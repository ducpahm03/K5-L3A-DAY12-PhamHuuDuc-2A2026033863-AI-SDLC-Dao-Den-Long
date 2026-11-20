import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const proofDir = resolve(root, 'docs/proof/phase-3');
mkdirSync(proofDir, { recursive: true });

// 1. Phase 3 fuel lifecycle + drain + refuel + dawn_survived scenario proof
const scenPath = resolve(proofDir, 'fuel_lifecycle.scenario.json');
const inpPath = resolve(proofDir, 'fuel_lifecycle.inputs.json');
const outPath = resolve(proofDir, 'fuel_lifecycle.jsonl');

writeFileSync(
  scenPath,
  JSON.stringify(
    {
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
    },
    null,
    2,
  ),
);

writeFileSync(
  inpPath,
  JSON.stringify(
    {
      frames: [
        { tick: 62, move: [0, 1] },
        { tick: 155, move: [0, 0], interact: true },
        { tick: 156, interact: false },
      ],
    },
    null,
    2,
  ),
);

execFileSync(
  process.execPath,
  [
    'dist/headless.mjs',
    '--seed',
    '42',
    '--night',
    '1',
    '--scenario',
    scenPath,
    '--inputs',
    inpPath,
    '--ticks',
    '200',
    '--snapshot-every',
    '30',
    '--out',
    outPath,
  ],
  { cwd: root },
);

// 2. Determinism & performance proof
const detA = resolve(proofDir, '_detA.jsonl');
const detB = resolve(proofDir, '_detB.jsonl');
const detArgs = ['dist/headless.mjs', '--seed', '1337', '--night', '3', '--ticks', '18000', '--snapshot-every', '600'];

const t0 = performance.now();
execFileSync(process.execPath, [...detArgs, '--out', detA], { cwd: root });
const msA = performance.now() - t0;
execFileSync(process.execPath, [...detArgs, '--out', detB], { cwd: root });

const bufA = readFileSync(detA);
const bufB = readFileSync(detB);
const shaA = createHash('sha256').update(bufA).digest('hex');
const shaB = createHash('sha256').update(bufB).digest('hex');
rmSync(detA, { force: true });
rmSync(detB, { force: true });

if (shaA !== shaB) {
  console.error('Determinism mismatch!');
  process.exit(1);
}

writeFileSync(
  resolve(proofDir, 'determinism.txt'),
  [
    'Command: node dist/headless.mjs --seed 1337 --night 3 --ticks 18000 --snapshot-every 600 --out <file>',
    `Elapsed (18,000 ticks): ${msA.toFixed(1)} ms`,
    `Run A bytes           : ${bufA.length}`,
    `Run B bytes           : ${bufB.length}`,
    `Run A SHA256          : ${shaA}`,
    `Run B SHA256          : ${shaB}`,
    `Identical             : ${shaA === shaB}`,
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Generated Phase 3 proofs in docs/proof/phase-3/ (SHA-256: ${shaA})`);
