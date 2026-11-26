/**
 * SQLite connection + migrations.
 *
 * One cached connection promise is shared by the UI and by the background
 * notification task (which may run while the UI is closed), so both always
 * go through the same migrations.
 *
 * Migrations are tracked with SQLite's built-in `PRAGMA user_version`:
 * add a new entry to MIGRATIONS to change the schema; never edit old ones.
 */
import * as SQLite from 'expo-sqlite';

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- The weekly template: one row per task per weekday (0 = Monday).
  CREATE TABLE IF NOT EXISTS template_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    time_minutes INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_template_profile_day ON template_tasks(profile_id, weekday);

  -- One row per tracked day. A day with zero day_tasks is a rest day.
  CREATE TABLE IF NOT EXISTS days (
    date TEXT PRIMARY KEY,
    profile_id INTEGER,
    created_at TEXT NOT NULL
  );

  -- Snapshot of the tasks that applied on a specific date. Past rows are
  -- never rewritten when the template changes, so history stays accurate.
  CREATE TABLE IF NOT EXISTS day_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL REFERENCES days(date) ON DELETE CASCADE,
    template_id INTEGER,
    title TEXT NOT NULL,
    time_minutes INTEGER NOT NULL,
    done_at TEXT,
    done_late INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, template_id)
  );
  CREATE INDEX IF NOT EXISTS idx_day_tasks_date ON day_tasks(date);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('lispo.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      let version = row?.user_version ?? 0;
      while (version < MIGRATIONS.length) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(MIGRATIONS[version]);
        });
        version++;
        await db.execAsync(`PRAGMA user_version = ${version}`);
      }
      return db;
    })().catch((e) => {
      dbPromise = null; // allow a retry on next call
      throw e;
    });
  }
  return dbPromise;
}

export const SCHEMA_VERSION = MIGRATIONS.length;
