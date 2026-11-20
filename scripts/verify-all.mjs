import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function runStep(title, cmd, args) {
  console.log(`\n=== ${title} ===`);
  const isWinNpm = process.platform === 'win32' && cmd === 'npm';
  const res = isWinNpm
    ? spawnSync('cmd.exe', ['/c', `npm ${args.join(' ')}`], { cwd: root, stdio: 'inherit' })
    : spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`FAILED at step: ${title} (exit=${res.status})`);
    process.exit(res.status ?? 1);
  }
}

runStep('1. Sync Check (game.contract.json == tuning.ts)', process.execPath, ['scripts/sync-check.mjs']);
runStep('2. TypeScript Typecheck', 'npm', ['run', 'typecheck']);
runStep('3. Build Web 3D + Headless CLI', 'npm', ['run', 'build']);
runStep('4. Unit & Contract Tests (Vitest)', 'npm', ['test']);

console.log('\n=== 5. Determinism Verification (2 identical headless runs, SHA-256) ===');
const tmpDir = resolve(root, 'tmp/verify-det');
mkdirSync(tmpDir, { recursive: true });
const outA = resolve(tmpDir, 'runA.jsonl');
const outB = resolve(tmpDir, 'runB.jsonl');
const cliArgs = ['dist/headless.mjs', '--seed', '1337', '--night', '1', '--ticks', '1800', '--snapshot-every', '30'];

execFileSync(process.execPath, [...cliArgs, '--out', outA], { cwd: root });
execFileSync(process.execPath, [...cliArgs, '--out', outB], { cwd: root });

const bufA = readFileSync(outA);
const bufB = readFileSync(outB);
const hashA = createHash('sha256').update(bufA).digest('hex');
const hashB = createHash('sha256').update(bufB).digest('hex');

rmSync(tmpDir, { recursive: true, force: true });

if (hashA !== hashB) {
  console.error(`Determinism FAILED: ${hashA} !== ${hashB}`);
  process.exit(1);
}
console.log(`Determinism OK: SHA-256 = ${hashA} (${bufA.length} bytes identical across 2 runs)`);
console.log('\nALL VERIFICATION CHECKS PASSED!');
