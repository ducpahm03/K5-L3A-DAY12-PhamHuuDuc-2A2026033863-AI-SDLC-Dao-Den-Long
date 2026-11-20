import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { InputTimeline, Simulation } from '../core/simulation.js';
import { getDefaultNight1Lanterns } from '../core/tuning.js';
import type { InputFrame, JsonlRecord, ScenarioSpec } from '../core/types.js';
import { ValidationError, validateInputsFile, validateScenarioSpec } from '../core/validation.js';

interface CliArgs {
  seed: number;
  night: number;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

function parseIntArg(flag: string, value: string | undefined): number {
  if (value === undefined || !/^-?\d+$/.test(value)) {
    throw new Error(`Invalid integer value for ${flag}: ${value ?? '(missing)'}`);
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Integer out of safe range for ${flag}: ${value}`);
  }
  return n;
}

function parseArgs(argv: string[]): CliArgs {
  let seed: number | undefined;
  let night: number | undefined;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--seed':
        seed = parseIntArg('--seed', argv[++i]);
        break;
      case '--night':
        night = parseIntArg('--night', argv[++i]);
        break;
      case '--scenario':
        scenarioPath = argv[++i];
        if (!scenarioPath) throw new Error('Missing path for --scenario');
        break;
      case '--inputs':
        inputsPath = argv[++i];
        if (!inputsPath) throw new Error('Missing path for --inputs');
        break;
      case '--ticks':
        ticks = parseIntArg('--ticks', argv[++i]);
        break;
      case '--out':
        outPath = argv[++i];
        if (!outPath) throw new Error('Missing path for --out');
        break;
      case '--snapshot-every':
        snapshotEvery = parseIntArg('--snapshot-every', argv[++i]);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (seed === undefined) throw new Error('Missing required flag --seed');
  if (night === undefined) throw new Error('Missing required flag --night');
  if (night !== 1) throw new Error(`Unsupported --night ${night} (Phase 1 supports --night 1 only)`);
  if (ticks === undefined || ticks < 0) throw new Error('Missing or invalid --ticks (must be >= 0)');
  if (!outPath) throw new Error('Missing required flag --out');
  if (snapshotEvery <= 0) throw new Error('--snapshot-every must be a positive integer');

  return { seed, night, scenarioPath, inputsPath, ticks, outPath, snapshotEvery };
}

function readJsonFile(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ${label} file "${path}": ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ValidationError(`Malformed JSON in ${label} file "${path}": ${(err as Error).message}`);
  }
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    const validLanternIds = new Set(getDefaultNight1Lanterns().map((l) => l.id));

    let scenario: ScenarioSpec | undefined;
    if (args.scenarioPath) {
      const raw = readJsonFile(args.scenarioPath, 'scenario');
      scenario = validateScenarioSpec(raw, validLanternIds);
    }

    let frames: InputFrame[] = [];
    if (args.inputsPath) {
      const raw = readJsonFile(args.inputsPath, 'inputs');
      frames = validateInputsFile(raw).frames;
    }

    const sim = new Simulation(args.seed, scenario);
    const timeline = new InputTimeline(frames);
    const lines: string[] = [];
    const push = (rec: JsonlRecord): void => {
      lines.push(JSON.stringify(rec));
    };

    // Snapshot tick 0 after scenario setup, before any input
    push(sim.getSnapshot());

    for (let k = 0; k < args.ticks; k++) {
      if (sim.state !== 'playing') break;
      const input = timeline.atTick(k);
      const events = sim.step(input);
      for (const ev of events) {
        push(ev);
      }
      if (sim.tick % args.snapshotEvery === 0) {
        push(sim.getSnapshot());
      }
      if (sim.state !== 'playing') break;
    }

    push(sim.getEndRecord());

    const outDir = dirname(args.outPath);
    if (outDir && outDir !== '.') {
      mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(args.outPath, lines.join('\n') + '\n', 'utf8');
    process.exit(0);
  } catch (err) {
    if (err instanceof ValidationError) {
      process.stderr.write(`ValidationError: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
