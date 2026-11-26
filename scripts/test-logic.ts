/**
 * Quick tests for the pure date/streak logic. Run with: npm test
 */
import assert from 'node:assert/strict';
import { addDays, formatMinutes, startOfWeek, weekdayOf, rangeKeys } from '../src/lib/dates';
import { DayStat, currentStreak, longestStreak, monthMetrics, statusOf } from '../src/lib/streak';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

// 2026-11-26 is a Thursday
const T = '2026-11-26';
const day = (date: string, total: number, done: number): DayStat => ({ date, total, done });

test('weekday is Monday-first', () => {
  assert.equal(weekdayOf(T), 3);
  assert.equal(weekdayOf('2026-11-23'), 0);
  assert.equal(weekdayOf('2026-11-29'), 6);
  assert.equal(startOfWeek(T), '2026-11-23');
});

test('addDays crosses months and years', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(rangeKeys('2026-11-29', '2026-12-02').length, 4);
});

test('formatMinutes', () => {
  assert.equal(formatMinutes(0), '12:00 AM');
  assert.equal(formatMinutes(8 * 60 + 5), '8:05 AM');
  assert.equal(formatMinutes(12 * 60), '12:00 PM');
  assert.equal(formatMinutes(23 * 60 + 59), '11:59 PM');
});

test('status classification', () => {
  assert.equal(statusOf(day(T, 3, 3), T, T), 'perfect');
  assert.equal(statusOf(day(T, 3, 1), T, T), 'pending');
  assert.equal(statusOf(day('2026-11-25', 3, 1), '2026-11-25', T), 'partial');
  assert.equal(statusOf(day('2026-11-25', 3, 0), '2026-11-25', T), 'missed');
  assert.equal(statusOf(day('2026-11-25', 0, 0), '2026-11-25', T), 'rest');
  assert.equal(statusOf(undefined, '2026-11-20', T), 'untracked');
  assert.equal(statusOf(undefined, '2026-11-27', T), 'future');
});

test('in-progress today does not break the streak', () => {
  const s = [day('2026-11-24', 2, 2), day('2026-11-25', 2, 2), day(T, 2, 0)];
  assert.equal(currentStreak(s, T), 2);
});

test('cleared today adds to the streak', () => {
  const s = [day('2026-11-24', 2, 2), day('2026-11-25', 2, 2), day(T, 2, 2)];
  assert.equal(currentStreak(s, T), 3);
});

test('rest days are neutral', () => {
  const s = [day('2026-11-22', 2, 2), day('2026-11-23', 0, 0), day('2026-11-24', 0, 0), day('2026-11-25', 1, 1), day(T, 1, 0)];
  assert.equal(currentStreak(s, T), 2);
});

test('missed day breaks the streak', () => {
  const s = [day('2026-11-23', 2, 2), day('2026-11-24', 2, 1), day('2026-11-25', 2, 2)];
  assert.equal(currentStreak(s, T), 1);
});

test('longest streak survives a break', () => {
  const s = [
    day('2026-11-18', 1, 1), day('2026-11-19', 1, 1), day('2026-11-20', 0, 0), day('2026-11-21', 1, 1),
    day('2026-11-22', 1, 0),
    day('2026-11-23', 1, 1), day('2026-11-24', 1, 1),
  ];
  assert.equal(longestStreak(s, T), 3);
  assert.equal(currentStreak(s, T), 2);
});

test('month metrics ignore rest days and future days', () => {
  const s = [day('2026-11-24', 2, 2), day('2026-11-25', 2, 1), day('2026-11-26', 0, 0), day('2026-10-31', 3, 3)];
  const m = monthMetrics(s, T, '2026-11');
  assert.equal(m.perfectDays, 1);
  assert.equal(m.trackedDays, 2);
  assert.equal(m.completionRate, 0.75);
});

console.log(`\n${passed} tests passed`);
