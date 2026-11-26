/**
 * Data access. All reads/writes go through here.
 *
 * Model in one paragraph:
 * - A profile owns a weekly *template* (template_tasks, one row per weekday task).
 *   Only one profile is active. The template repeats every week, every month.
 * - Each calendar day gets a *snapshot* (days + day_tasks) copied from the active
 *   template the first time that day is seen. Marking done writes to the snapshot.
 * - Editing the template updates today's snapshot (keeping done state) and all
 *   future days automatically (they aren't snapshotted yet). Past days never change.
 */
import { getDb } from './client';
import { emitChange } from '../lib/events';
import { DateKey, addDays, minutesOf, todayKey, weekdayOf } from '../lib/dates';
import type { DayStat } from '../lib/streak';

export type Profile = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  taskCount: number;
};

export type TemplateTask = {
  id: number;
  profileId: number;
  weekday: number;
  title: string;
  notes: string | null;
  timeMinutes: number;
};

export type DayTask = {
  id: number;
  date: DateKey;
  templateId: number | null;
  title: string;
  timeMinutes: number;
  doneAt: string | null;
  doneLate: boolean;
};

type TemplateRow = { id: number; profile_id: number; weekday: number; title: string; notes: string | null; time_minutes: number };
type DayTaskRow = { id: number; date: string; template_id: number | null; title: string; time_minutes: number; done_at: string | null; done_late: number };

const mapTemplate = (r: TemplateRow): TemplateTask => ({
  id: r.id,
  profileId: r.profile_id,
  weekday: r.weekday,
  title: r.title,
  notes: r.notes,
  timeMinutes: r.time_minutes,
});

const mapDayTask = (r: DayTaskRow): DayTask => ({
  id: r.id,
  date: r.date,
  templateId: r.template_id,
  title: r.title,
  timeMinutes: r.time_minutes,
  doneAt: r.done_at,
  doneLate: !!r.done_late,
});

// ---------------------------------------------------------------- settings

export const SettingKeys = {
  trackingStart: 'tracking_start', // DateKey of the first ever tracked day
  activatedAt: 'activated_at', // ISO time the current profile was activated
  followupEnabled: 'followup_enabled', // '1' | '0'
  followupMinutes: 'followup_minutes', // number as string
  lastSetupHintDismissed: 'setup_hint_dismissed', // DateKey
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  emitChange();
}

export async function getFollowupConfig(): Promise<{ enabled: boolean; minutes: number }> {
  const [enabled, minutes] = await Promise.all([getSetting(SettingKeys.followupEnabled), getSetting(SettingKeys.followupMinutes)]);
  return { enabled: enabled !== '0', minutes: minutes ? Number(minutes) : 30 };
}

// ---------------------------------------------------------------- profiles

export async function listProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string; is_active: number; created_at: string; task_count: number }>(
    `SELECT p.*, (SELECT COUNT(*) FROM template_tasks t WHERE t.profile_id = p.id AND t.archived = 0) AS task_count
     FROM profiles p ORDER BY p.is_active DESC, p.created_at ASC`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: !!r.is_active, createdAt: r.created_at, taskCount: r.task_count }));
}

export async function getActiveProfile(): Promise<Profile | null> {
  return (await listProfiles()).find((p) => p.isActive) ?? null;
}

export async function getProfile(id: number): Promise<Profile | null> {
  return (await listProfiles()).find((p) => p.id === id) ?? null;
}

export async function createProfile(name: string): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync('INSERT INTO profiles (name, is_active, created_at) VALUES (?, 0, ?)', name.trim(), new Date().toISOString());
  emitChange();
  return res.lastInsertRowId;
}

export async function renameProfile(id: number, name: string) {
  const db = await getDb();
  await db.runAsync('UPDATE profiles SET name = ? WHERE id = ?', name.trim(), id);
  emitChange();
}

/** Deletes a profile that is not active. History (past days) is kept. */
export async function deleteProfile(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM profiles WHERE id = ? AND is_active = 0', id);
  emitChange();
}

/**
 * Makes `id` the only active profile. Today's snapshot is rebuilt from the new
 * profile's template (the confirm dialog warns about this).
 */
export async function activateProfile(id: number) {
  const db = await getDb();
  const today = todayKey();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE profiles SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END', id);
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', SettingKeys.trackingStart, today);
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      SettingKeys.activatedAt,
      new Date().toISOString()
    );
  });
  await ensureDays();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM day_tasks WHERE date = ?', today);
    await db.runAsync('UPDATE days SET profile_id = ? WHERE date = ?', id, today);
    await snapshotDay(today, id);
  });
  emitChange();
}

// ---------------------------------------------------------------- template

export async function listTemplateTasks(profileId: number): Promise<TemplateTask[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TemplateRow>(
    'SELECT * FROM template_tasks WHERE profile_id = ? AND archived = 0 ORDER BY weekday, time_minutes, id',
    profileId
  );
  return rows.map(mapTemplate);
}

export async function getTemplateTask(id: number): Promise<TemplateTask | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TemplateRow>('SELECT * FROM template_tasks WHERE id = ?', id);
  return row ? mapTemplate(row) : null;
}

export type TaskInput = { title: string; timeMinutes: number; notes?: string | null };

async function isActiveProfile(profileId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ is_active: number }>('SELECT is_active FROM profiles WHERE id = ?', profileId);
  return !!row?.is_active;
}

export async function addTemplateTask(profileId: number, weekday: number, input: TaskInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO template_tasks (profile_id, weekday, title, notes, time_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    profileId,
    weekday,
    input.title.trim(),
    input.notes?.trim() || null,
    input.timeMinutes,
    new Date().toISOString()
  );
  const today = todayKey();
  if (weekday === weekdayOf(today) && (await isActiveProfile(profileId)) && (await dayExists(today))) {
    await db.runAsync(
      'INSERT OR IGNORE INTO day_tasks (date, template_id, title, time_minutes) VALUES (?, ?, ?, ?)',
      today,
      res.lastInsertRowId,
      input.title.trim(),
      input.timeMinutes
    );
  }
  emitChange();
  return res.lastInsertRowId;
}

export async function updateTemplateTask(id: number, input: TaskInput) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE template_tasks SET title = ?, notes = ?, time_minutes = ? WHERE id = ?',
    input.title.trim(),
    input.notes?.trim() || null,
    input.timeMinutes,
    id
  );
  // Today's snapshot follows the edit; done state is kept. Past days untouched.
  await db.runAsync('UPDATE day_tasks SET title = ?, time_minutes = ? WHERE template_id = ? AND date = ?', input.title.trim(), input.timeMinutes, id, todayKey());
  emitChange();
}

/** Soft-deletes so old history rows can still be traced back. Removes it from today. */
export async function deleteTemplateTask(id: number) {
  const db = await getDb();
  await db.runAsync('UPDATE template_tasks SET archived = 1 WHERE id = ?', id);
  await db.runAsync('DELETE FROM day_tasks WHERE template_id = ? AND date = ?', id, todayKey());
  emitChange();
}

/** Copies one weekday's tasks onto other weekdays, skipping exact duplicates. */
export async function copyWeekday(profileId: number, fromWeekday: number, toWeekdays: number[]) {
  const all = await listTemplateTasks(profileId);
  const source = all.filter((t) => t.weekday === fromWeekday);
  for (const wd of toWeekdays) {
    if (wd === fromWeekday) continue;
    const existing = all.filter((t) => t.weekday === wd);
    for (const t of source) {
      if (existing.some((e) => e.title === t.title && e.timeMinutes === t.timeMinutes)) continue;
      await addTemplateTask(profileId, wd, { title: t.title, timeMinutes: t.timeMinutes, notes: t.notes });
    }
  }
  emitChange();
}

// ---------------------------------------------------------------- days

async function dayExists(date: DateKey) {
  const db = await getDb();
  return !!(await db.getFirstAsync('SELECT 1 FROM days WHERE date = ?', date));
}

async function snapshotDay(date: DateKey, profileId: number | null) {
  if (profileId == null) return;
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO day_tasks (date, template_id, title, time_minutes)
     SELECT ?, id, title, time_minutes FROM template_tasks
     WHERE profile_id = ? AND weekday = ? AND archived = 0`,
    date,
    profileId,
    weekdayOf(date)
  );
}

/**
 * Creates snapshots for every day from the last tracked day (or the tracking
 * start) up to today. Days the app wasn't opened still get their tasks, so
 * they correctly show as missed instead of disappearing.
 */
export async function ensureDays(today: DateKey = todayKey()) {
  const db = await getDb();
  const start = await getSetting(SettingKeys.trackingStart);
  if (!start) return;
  const last = await db.getFirstAsync<{ date: string }>('SELECT MAX(date) AS date FROM days');
  let from = last?.date ? addDays(last.date, 1) : start;
  if (from > today) return;
  const active = await db.getFirstAsync<{ id: number }>('SELECT id FROM profiles WHERE is_active = 1');
  const profileId = active?.id ?? null;
  await db.withTransactionAsync(async () => {
    for (let d = from; d <= today; d = addDays(d, 1)) {
      await db.runAsync('INSERT OR IGNORE INTO days (date, profile_id, created_at) VALUES (?, ?, ?)', d, profileId, new Date().toISOString());
      await snapshotDay(d, profileId);
    }
  });
  emitChange();
}

export async function getDayTasks(date: DateKey): Promise<DayTask[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayTaskRow>('SELECT * FROM day_tasks WHERE date = ? ORDER BY time_minutes, id', date);
  return rows.map(mapDayTask);
}

export async function getDayTask(id: number): Promise<DayTask | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DayTaskRow>('SELECT * FROM day_tasks WHERE id = ?', id);
  return row ? mapDayTask(row) : null;
}

/** Only today and yesterday can be changed ("fix yesterday" rule). */
export function canEditDate(date: DateKey, today: DateKey = todayKey()) {
  return date === today || date === addDays(today, -1);
}

export async function setDone(dayTaskId: number, done: boolean) {
  const db = await getDb();
  const task = await getDayTask(dayTaskId);
  if (!task) return;
  const today = todayKey();
  if (!canEditDate(task.date, today)) throw new Error('Only today and yesterday can be changed.');
  await db.runAsync(
    'UPDATE day_tasks SET done_at = ?, done_late = ? WHERE id = ?',
    done ? new Date().toISOString() : null,
    done && task.date < today ? 1 : 0,
    dayTaskId
  );
  emitChange();
}

/** Marks done by (date, template) – used from the notification action. */
export async function setDoneByTemplate(date: DateKey, templateId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM day_tasks WHERE date = ? AND template_id = ?', date, templateId);
  if (row) await setDone(row.id, true);
}

export async function getDayStats(): Promise<DayStat[]> {
  const db = await getDb();
  return db.getAllAsync<DayStat>(
    `SELECT d.date AS date, COUNT(t.id) AS total, COUNT(t.done_at) AS done
     FROM days d LEFT JOIN day_tasks t ON t.date = d.date
     GROUP BY d.date ORDER BY d.date`
  );
}

export async function getMostMissedTask(today: DateKey = todayKey()): Promise<{ title: string; misses: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ title: string; misses: number }>(
    `SELECT MAX(title) AS title, COUNT(*) AS misses FROM day_tasks
     WHERE done_at IS NULL AND date < ? AND date >= ?
     GROUP BY COALESCE(template_id, title) ORDER BY misses DESC LIMIT 1`,
    today,
    addDays(today, -30)
  );
  return row && row.misses > 0 ? row : null;
}

export async function getTotalDone(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM day_tasks WHERE done_at IS NOT NULL');
  return row?.n ?? 0;
}

/** Today's tasks scheduled before the profile was activated today (no reminder was possible). */
export async function getActivatedAtMinutesToday(): Promise<number | null> {
  const iso = await getSetting(SettingKeys.activatedAt);
  if (!iso) return null;
  const at = new Date(iso);
  return todayKey(at) === todayKey() ? minutesOf(at) : null;
}

// ---------------------------------------------------------------- backup

const TABLES = ['profiles', 'template_tasks', 'days', 'day_tasks', 'settings'] as const;

export async function exportAll() {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return { app: 'lispo', version: 1, exportedAt: new Date().toISOString(), tables };
}

export async function importAll(data: unknown) {
  const parsed = data as { app?: string; tables?: Record<string, Record<string, unknown>[]> };
  if (parsed?.app !== 'lispo' || !parsed.tables) throw new Error('This file is not a Lispo backup.');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Children first when deleting, parents first when inserting.
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      for (const row of parsed.tables![t] ?? []) {
        // Column names come from a file, so only allow plain identifiers.
        const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
        if (!cols.length) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          ...cols.map((c) => row[c] as SQLiteValue)
        );
      }
    }
  });
  emitChange();
}

type SQLiteValue = string | number | null;
