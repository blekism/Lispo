// Node test stub for expo-sqlite, backed by node:sqlite (in-memory).
import { DatabaseSync } from 'node:sqlite';

type V = string | number | null;
class Db {
  d = new DatabaseSync(':memory:');
  async execAsync(sql: string) { this.d.exec(sql); }
  async runAsync(sql: string, ...args: V[]) {
    const r = this.d.prepare(sql).run(...args);
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  }
  async getFirstAsync<T>(sql: string, ...args: V[]) { return (this.d.prepare(sql).get(...args) as T) ?? null; }
  async getAllAsync<T>(sql: string, ...args: V[]) { return this.d.prepare(sql).all(...args) as T[]; }
  async withTransactionAsync(fn: () => Promise<void>) {
    this.d.exec('BEGIN');
    try { await fn(); this.d.exec('COMMIT'); } catch (e) { this.d.exec('ROLLBACK'); throw e; }
  }
}
export type SQLiteDatabase = Db;
export async function openDatabaseAsync() { return new Db(); }
