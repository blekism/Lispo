/**
 * Backup = one JSON file with every table. Export writes it to the cache
 * folder and opens the Android share sheet (save to Drive/Files, send to
 * yourself, etc.). Import picks a file and replaces all local data.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAll, importAll } from '../db/repo';
import { todayKey } from './dates';

export async function shareBackup() {
  const data = await exportAll();
  const file = new File(Paths.cache, `lispo-backup-${todayKey()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Lispo backup' });
}

/** Returns false if the user cancelled the picker. Throws on an invalid file. */
export async function pickAndRestoreBackup(): Promise<boolean> {
  const result = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (result.canceled) return false;
  const text = await result.result.text();
  await importAll(JSON.parse(text));
  return true;
}
