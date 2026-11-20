export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export const LEADERBOARD_FILE = 'leaderboard.json';

export function validatePlayerName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 12) return false;
  // Ticket-04: 3-12 ký tự [A-Za-z0-9_]. Hỗ trợ tiếng Việt có dấu.
  return /^[\p{L}0-9_]{3,12}$/u.test(trimmed);
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime();
  }).slice(0, 10);
}

export function getLocalIsoString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const tzH = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMin = pad(Math.abs(tzOffset) % 60);
  return `${y}-${m}-${d}T${h}:${min}:${s}${sign}${tzH}:${tzMin}`;
}
