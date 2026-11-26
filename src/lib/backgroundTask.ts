/**
 * Runs when "Mark done" is pressed on a notification while Lispo is in the
 * background or closed. Must be defined at module scope and imported before
 * the router starts, which is why index.ts imports this file first.
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { handleNotificationResponse } from './notifications';

export const NOTIFICATION_TASK = 'LISPO_NOTIFICATION_TASK';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ('actionIdentifier' in data) {
    try {
      await handleNotificationResponse(data);
    } catch (e) {
      console.warn('Background mark-done failed', e);
    }
  }
});

export async function registerBackgroundTask() {
  try {
    await Notifications.registerTaskAsync(NOTIFICATION_TASK);
  } catch (e) {
    console.warn('registerTaskAsync failed', e);
  }
}
