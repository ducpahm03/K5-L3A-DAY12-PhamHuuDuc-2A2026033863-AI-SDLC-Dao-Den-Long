import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { round1, SeededRng } from '../core/rng.js';
import { Simulation } from '../core/simulation.js';
import { TICK_RATE } from '../core/tuning.js';
import type { NightNumber, ResolvedInput, Vec2 } from '../core/types.js';

interface SoakArgs {
  seed: number;
  nights: number;
  outPath: string;
}

function parseArgs(argv: string[]): SoakArgs {
  let seed = 7;
  let nights = 10;
  let outPath = 'soak.json';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') seed = Number.parseInt(argv[++i], 10);
    else if (a === '--nights') nights = Number.parseInt(argv[++i], 10);
    else if (a === '--out') outPath = argv[++i];
  }
  if (!Number.isFinite(seed) || !Number.isFinite(nights) || nights <= 0 || !outPath) {
    throw new Error('Usage: soak --seed <int> --nights <int> --out <file.json>');
  }
  return { seed, nights, outPath };
}

function rssMb(): number {
  return round1(process.memoryUsage().rss / (1024 * 1024));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  const results: Array<'won' | 'lost'> = [];
  let crashes = 0;
  let memStartMb = 0;

  for (let i = 0; i < args.nights; i++) {
    const night = ((i % 3) + 1) as NightNumber;
    const nightSeed = args.seed + i;
    try {
      const sim = new Simulation(nightSeed, night);
      if (i === 0) {
        memStartMb = rssMb();
      }
      const botRng = new SeededRng(nightSeed ^ 0x5a5a5a5a);
      const maxTicks = sim.map.durationS * TICK_RATE + 10;
      let moveDir: Vec2 = [0, 1];
      let prevJump = false;
      let prevDash = false;
      let prevPulse = false;
      let prevInteract = false;

      for (let k = 0; k < maxTicks; k++) {
        if (sim.state === 'won' || sim.state === 'lost') break;
        if (k % 30 === 0) {
          const angle = botRng.range(0, Math.PI * 2);
          moveDir = [Math.cos(angle), Math.sin(angle)];
        }
        const wantJump = botRng.next() < 0.05;
        const wantDash = botRng.next() < 0.03;
        const wantPulse = botRng.next() < 0.02;
        const wantInteract = botRng.next() < 0.1;

        const input: ResolvedInput = {
          move: moveDir,
          cam_yaw_deg: 0,
          jump: wantJump && !prevJump,
          dash: wantDash && !prevDash,
          pulse: wantPulse && !prevPulse,
          interact: wantInteract && !prevInteract,
          pause: false,
        };
        prevJump = input.jump;
        prevDash = input.dash;
        prevPulse = input.pulse;
        prevInteract = input.interact;

        sim.step(input);
      }
      results.push(sim.state === 'won' ? 'won' : 'lost');
    } catch {
      crashes++;
      results.push('lost');
    }
  }

  // Force reset before sampling end RSS
  const memEndMb = rssMb();
  const durationS = round1((performance.now() - t0) / 1000);

  const report = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const dir = dirname(args.outPath);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(args.outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

main();
