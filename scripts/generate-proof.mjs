import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const proofDir = resolve(root, 'docs/proof/phase-1');
mkdirSync(proofDir, { recursive: true });

// 1. Win Night 1 scenario proof
const winOut = resolve(proofDir, 'win_night1.jsonl');
execFileSync(
  process.execPath,
  [
    'dist/headless.mjs',
    '--seed',
    '42',
    '--night',
    '1',
    '--scenario',
    'tests/scenarios/win_night1.scenario.json',
    '--inputs',
    'tests/scenarios/win_night1.inputs.json',
    '--ticks',
    '300',
    '--snapshot-every',
    '20',
    '--out',
    winOut,
  ],
  { cwd: root },
);

// 2. Pulse stun & push proof
const pulseOut = resolve(proofDir, 'pulse_stun.jsonl');
execFileSync(
  process.execPath,
  [
    'dist/headless.mjs',
    '--seed',
    '42',
    '--night',
    '1',
    '--scenario',
    'tests/scenarios/pulse_stun.scenario.json',
    '--inputs',
    'tests/scenarios/pulse_stun.inputs.json',
    '--ticks',
    '210',
    '--snapshot-every',
    '30',
    '--out',
    pulseOut,
  ],
  { cwd: root },
);

// 3. Determinism proof (2 identical 1800-tick runs compared by SHA-256)
const detA = resolve(proofDir, '_detA.jsonl');
const detB = resolve(proofDir, '_detB.jsonl');
const detArgs = [
  'dist/headless.mjs',
  '--seed',
  '1337',
  '--night',
  '1',
  '--ticks',
  '1800',
  '--snapshot-every',
  '30',
];
execFileSync(process.execPath, [...detArgs, '--out', detA], { cwd: root });
execFileSync(process.execPath, [...detArgs, '--out', detB], { cwd: root });

const bufA = readFileSync(detA);
const bufB = readFileSync(detB);
const shaA = createHash('sha256').update(bufA).digest('hex');
const shaB = createHash('sha256').update(bufB).digest('hex');
rmSync(detA, { force: true });
rmSync(detB, { force: true });

if (shaA !== shaB) {
  console.error('Determinism mismatch while generating proof!');
  process.exit(1);
}

writeFileSync(
  resolve(proofDir, 'determinism.txt'),
  [
    'Command: node dist/headless.mjs --seed 1337 --night 1 --ticks 1800 --snapshot-every 30 --out <file>',
    `Run A bytes : ${bufA.length}`,
    `Run B bytes : ${bufB.length}`,
    `Run A SHA256: ${shaA}`,
    `Run B SHA256: ${shaB}`,
    `Identical   : ${shaA === shaB}`,
    '',
  ].join('\n'),
  'utf8',
);

console.log('Generated real Phase 1 headless proofs in docs/proof/phase-1/');
console.log(` - win_night1.jsonl (${readFileSync(winOut, 'utf8').trim().split('\n').length} lines)`);
console.log(` - pulse_stun.jsonl (${readFileSync(pulseOut, 'utf8').trim().split('\n').length} lines)`);
console.log(` - determinism.txt (SHA-256: ${shaA})`);
