/**
 * Pure streak/metrics logic. No database or React here, so it is easy to test
 * (see scripts/test-streak.ts).
 *
 * Rules (agreed with the user):
 * - A day is "perfect" (lit) when it has tasks and all of them are done.
 * - A day with zero tasks is a "rest" day: it neither breaks nor extends a streak.
 * - Today never breaks the streak while it is still in progress. It only adds
 *   to the streak once it is fully cleared.
 */
import { DateKey } from './dates';

export type DayStat = { date: DateKey; total: number; done: number };
export type DayStatus = 'perfect' | 'partial' | 'missed' | 'rest' | 'pending' | 'future' | 'untracked';

export function statusOf(stat: DayStat | undefined, date: DateKey, today: DateKey): DayStatus {
  if (date > today) return 'future';
  if (!stat) return 'untracked';
  if (stat.total === 0) return 'rest';
  if (stat.done >= stat.total) return 'perfect';
  if (date === today) return 'pending';
  return stat.done > 0 ? 'partial' : 'missed';
}

/** `stats` may be in any order; untracked days simply aren't in the list. */
export function currentStreak(stats: DayStat[], today: DateKey): number {
  const sorted = [...stats].filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const s of sorted) {
    const st = statusOf(s, s.date, today);
    if (st === 'perfect') streak++;
    else if (st === 'rest' || st === 'pending') continue;
    else break;
  }
  return streak;
}

export function longestStreak(stats: DayStat[], today: DateKey): number {
  const sorted = [...stats].filter((s) => s.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  let best = 0;
  let run = 0;
  for (const s of sorted) {
    const st = statusOf(s, s.date, today);
    if (st === 'perfect') {
      run++;
      best = Math.max(best, run);
    } else if (st === 'rest' || st === 'pending') {
      continue;
    } else {
      run = 0;
    }
  }
  return best;
}

export type MonthMetrics = {
  perfectDays: number;
  trackedDays: number; // non-rest days up to today
  completionRate: number; // 0..1 of tasks done
};

export function monthMetrics(stats: DayStat[], today: DateKey, monthPrefix: string): MonthMetrics {
  let perfectDays = 0;
  let trackedDays = 0;
  let total = 0;
  let done = 0;
  for (const s of stats) {
    if (!s.date.startsWith(monthPrefix) || s.date > today || s.total === 0) continue;
    trackedDays++;
    total += s.total;
    done += Math.min(s.done, s.total);
    if (s.done >= s.total) perfectDays++;
  }
  return { perfectDays, trackedDays, completionRate: total ? done / total : 0 };
}

/** Encouraging line for a streak count. */
export function streakMessage(streak: number, todayCleared: boolean): string {
  if (streak === 0) return todayCleared ? 'Nice work today!' : 'Every streak starts with one day. Clear today’s list!';
  if (streak === 1) return todayCleared ? 'Day one, done. Come back tomorrow to keep it going.' : 'You’re on the board. Keep it alive today.';
  if (streak < 7) return `${streak} days strong. Don’t break the chain.`;
  if (streak < 14) return 'Over a week of perfect days. You’re on a roll!';
  if (streak < 30) return 'This is turning into a habit. Keep going!';
  return 'A whole month lit up. Incredible consistency.';
}
