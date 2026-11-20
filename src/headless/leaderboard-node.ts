import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type LeaderboardEntry, LEADERBOARD_FILE, sortLeaderboard } from '../core/leaderboard.js';

export function readLeaderboardNode(filePath: string = LEADERBOARD_FILE): LeaderboardEntry[] {
  try {
    if (!existsSync(filePath)) return [];
    const text = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return sortLeaderboard(parsed);
  } catch {
    return [];
  }
}

export function saveLeaderboardNode(entries: LeaderboardEntry[], filePath: string = LEADERBOARD_FILE): void {
  const sorted = sortLeaderboard(entries);
  const dir = dirname(filePath);
  if (dir && dir !== '.') {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}
