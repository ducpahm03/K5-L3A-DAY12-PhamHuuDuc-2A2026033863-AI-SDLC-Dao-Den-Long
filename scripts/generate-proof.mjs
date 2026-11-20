import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const proofDir = resolve(root, 'docs/proof/phase-2');
mkdirSync(proofDir, { recursive: true });

// 1. Night 1, 2, 3 sample headless runs
for (const night of [1, 2, 3]) {
  const out = resolve(proofDir, `night${night}_sample.jsonl`);
  execFileSync(
    process.execPath,
    ['dist/headless.mjs', '--seed', '42', '--night', String(night), '--ticks', '600', '--snapshot-every', '120', '--out', out],
    { cwd: root },
  );
}

// 2. Full 21,600-tick Night 3 determinism & speed benchmark
const detA = resolve(proofDir, '_detA.jsonl');
const detB = resolve(proofDir, '_detB.jsonl');
const detArgs = ['dist/headless.mjs', '--seed', '1337', '--night', '3', '--ticks', '21600', '--snapshot-every', '600'];

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
  resolve(proofDir, 'perf_and_determinism.txt'),
  [
    'Command: node dist/headless.mjs --seed 1337 --night 3 --ticks 21600 --snapshot-every 600 --out <file>',
    `Elapsed (21,600 ticks): ${msA.toFixed(1)} ms (Contract v1.1 limit <= 30,000 ms)`,
    `Run A bytes           : ${bufA.length}`,
    `Run B bytes           : ${bufB.length}`,
    `Run A SHA256          : ${shaA}`,
    `Run B SHA256          : ${shaB}`,
    `Identical             : ${shaA === shaB}`,
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Generated Phase 2 proofs in docs/proof/phase-2/ (21,600 ticks in ${msA.toFixed(1)} ms, SHA-256: ${shaA})`);
