import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const contractPath = resolve(root, 'game.contract.json');
const tuningPath = resolve(root, 'src/core/tuning.ts');

const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const tuningSrc = readFileSync(tuningPath, 'utf8');

const m = tuningSrc.match(/export const TUNING = (\{[\s\S]*?\}) as const;/);
if (!m) {
  console.error('Could not parse TUNING object from src/core/tuning.ts');
  process.exit(1);
}

// Safely evaluate literal object using Function on static source
const codeTuning = new Function(`return (${m[1]});`)();

function deepEqual(a, b, path = 'tuning') {
  if (a === b) return [];
  if (typeof a !== typeof b || a === null || b === null) {
    return [`Mismatch at ${path}: contract=${JSON.stringify(a)} vs code=${JSON.stringify(b)}`];
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs = [];
    for (const k of keys) {
      diffs.push(...deepEqual(a[k], b[k], `${path}.${k}`));
    }
    return diffs;
  }
  return [`Mismatch at ${path}: contract=${a} vs code=${b}`];
}

const diffs = deepEqual(contract.tuning, codeTuning);
if (diffs.length > 0) {
  console.error('game.contract.json tuning is OUT OF SYNC with src/core/tuning.ts:');
  for (const d of diffs) console.error(' - ' + d);
  process.exit(1);
}

console.log('sync-check OK: game.contract.json matches src/core/tuning.ts 100%.');
