/**
 * Integration test of the data layer against an in-memory SQLite
 * (node:sqlite stub). Run with: npm test
 */
import assert from 'node:assert/strict';
import * as repo from '../src/db/repo';
import { getDb } from '../src/db/client';
import { addDays, todayKey, weekdayOf } from '../src/lib/dates';
import { currentStreak } from '../src/lib/streak';

const today = todayKey();
const wd = weekdayOf(today);

(async () => {
  // Setup wizard: create profile, add tasks for today and tomorrow.
  const pid = await repo.createProfile('Weekday grind');
  const a = await repo.addTemplateTask(pid, wd, { title: 'Read', timeMinutes: 8 * 60 });
  await repo.addTemplateTask(pid, wd, { title: 'Gym', timeMinutes: 18 * 60 });
  await repo.addTemplateTask(pid, (wd + 1) % 7, { title: 'Tomorrow task', timeMinutes: 9 * 60 });
  assert.equal((await repo.getDayTasks(today)).length, 0, 'inactive profile does not snapshot');

  await repo.activateProfile(pid);
  let tasks = await repo.getDayTasks(today);
  assert.equal(tasks.length, 2, 'activation snapshots today');
  assert.equal((await repo.getActiveProfile())?.id, pid);

  // Mark done + undo
  await repo.setDone(tasks[0].id, true);
  await repo.setDone(tasks[1].id, true);
  let stats = await repo.getDayStats();
  assert.equal(currentStreak(stats, today), 1, 'cleared today -> streak 1');
  await repo.setDone(tasks[1].id, false);
  stats = await repo.getDayStats();
  assert.equal(currentStreak(stats, today), 0);

  // Edit keeps done state and updates today
  await repo.updateTemplateTask(a, { title: 'Read 20 pages', timeMinutes: 7 * 60 });
  tasks = await repo.getDayTasks(today);
  const read = tasks.find((t) => t.templateId === a)!;
  assert.equal(read.title, 'Read 20 pages');
  assert.ok(read.doneAt, 'done state kept after edit');

  // Adding a task for today's weekday shows up today
  await repo.addTemplateTask(pid, wd, { title: 'Late add', timeMinutes: 21 * 60 });
  assert.equal((await repo.getDayTasks(today)).length, 3);

  // Delete removes from today, template archived
  await repo.deleteTemplateTask(a);
  assert.equal((await repo.getDayTasks(today)).length, 2);
  assert.equal((await repo.listTemplateTasks(pid)).filter((t) => t.weekday === wd).length, 2);

  // Copy weekday skips duplicates
  await repo.copyWeekday(pid, wd, [(wd + 1) % 7]);
  await repo.copyWeekday(pid, wd, [(wd + 1) % 7]);
  assert.equal((await repo.listTemplateTasks(pid)).filter((t) => t.weekday === (wd + 1) % 7).length, 3);

  // Days materialize forward; the past is frozen.
  const tomorrow = addDays(today, 1);
  await repo.ensureDays(addDays(today, 2));
  assert.equal((await repo.getDayTasks(tomorrow)).length, 3, 'tomorrow snapshotted from template');
  assert.throws(() => { if (!repo.canEditDate(addDays(today, -2))) throw new Error(); });
  assert.ok(repo.canEditDate(addDays(today, -1)));

  // Switching profiles rebuilds today; history kept; streak shared.
  const p2 = await repo.createProfile('Vacation');
  await repo.addTemplateTask(p2, wd, { title: 'Swim', timeMinutes: 10 * 60 });
  await repo.activateProfile(p2);
  tasks = await repo.getDayTasks(today);
  assert.deepEqual(tasks.map((t) => t.title), ['Swim']);
  assert.equal((await repo.listProfiles()).filter((p) => p.isActive).length, 1);

  // Deleting the active profile is refused; inactive is allowed.
  await repo.deleteProfile(p2);
  assert.ok(await repo.getProfile(p2));
  await repo.deleteProfile(pid);
  assert.equal(await repo.getProfile(pid), null);

  // Backup round-trip
  const dump = await repo.exportAll();
  const db = await getDb();
  await db.runAsync('DELETE FROM day_tasks');
  await repo.importAll(JSON.parse(JSON.stringify(dump)));
  assert.deepEqual((await repo.getDayTasks(today)).map((t) => t.title), ['Swim']);
  await assert.rejects(() => repo.importAll({ nope: true }));

  console.log('✓ repo integration test passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
