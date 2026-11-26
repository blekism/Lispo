/**
 * Local notifications: no server involved. The OS (Android AlarmManager under
 * the hood) fires them at the scheduled time even if Lispo is closed.
 *
 * Strategy: "rolling window". Whenever data changes or the app opens, we cancel
 * everything and re-schedule the next N days from the routine. Re-scheduling
 * from scratch is simpler and safer than diffing individual alarms, and it's
 * cheap (a few hundred calls at most).
 *
 * Android caps an app at ~500 pending alarms, so N shrinks if a routine has
 * lots of tasks per day. expo-notifications also restores pending alarms after
 * a phone reboot on its own.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDb } from '../db/client';
import { ensureDays, getDayTasks, getFollowupConfig, listTemplateTasks, setDoneByTemplate } from '../db/repo';
import { addDays, atMinutes, formatMinutes, todayKey, weekdayOf } from './dates';

export const CHANNEL_ID = 'reminders';
export const CATEGORY_ID = 'task_reminder';
export const ACTION_DONE = 'mark_done';

const MAX_PENDING = 450; // headroom under Android's 500 limit
const MAX_DAYS = 14;

type ReminderData = { date: string; templateId: number; kind: 'main' | 'followup' };

let configured = false;

export async function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Task reminders',
      description: 'Reminders for the tasks in your routine',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    // opensAppToForeground: false -> handled by the background task in backgroundTask.ts
    { identifier: ACTION_DONE, buttonTitle: 'Mark done', options: { opensAppToForeground: false } },
  ]);
}

export type PermissionState = { notifications: boolean; exactAlarms: boolean };

export async function getPermissionState(): Promise<PermissionState> {
  const n = await Notifications.getPermissionsAsync();
  let exact = true;
  if (Platform.OS === 'android') {
    try {
      exact = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      exact = true;
    }
  }
  return { notifications: n.granted, exactAlarms: exact };
}

export async function requestNotificationPermission(): Promise<boolean> {
  await configureNotifications(); // Android 13+: a channel must exist before the prompt shows
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Opens the "Alarms & reminders" system screen. Resolves when the user returns. */
export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const { granted } = await Notifications.getExactAlarmPermissionsAsync();
    if (granted) return true;
    await Notifications.requestExactAlarmPermissionsAsync();
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const idFor = (d: ReminderData) => `lispo_${d.date.replace(/-/g, '')}_${d.templateId}_${d.kind}`;

type Planned = { id: string; at: Date; title: string; body: string; data: ReminderData };

async function plan(): Promise<Planned[]> {
  const db = await getDb();
  const active = await db.getFirstAsync<{ id: number }>('SELECT id FROM profiles WHERE is_active = 1');
  if (!active) return [];

  const now = new Date();
  const today = todayKey(now);
  const followup = await getFollowupConfig();
  const template = await listTemplateTasks(active.id);

  const perDay = Math.max(1, ...Array.from({ length: 7 }, (_, wd) => template.filter((t) => t.weekday === wd).length));
  const perTask = followup.enabled ? 2 : 1;
  const days = Math.max(1, Math.min(MAX_DAYS, Math.floor(MAX_PENDING / (perDay * perTask))));

  const out: Planned[] = [];
  const push = (date: string, templateId: number, title: string, mins: number) => {
    const main = atMinutes(date, mins);
    if (main > now) {
      const data: ReminderData = { date, templateId, kind: 'main' };
      out.push({ id: idFor(data), at: main, title, body: `Scheduled for ${formatMinutes(mins)}`, data });
    }
    if (followup.enabled) {
      const at = new Date(main.getTime() + followup.minutes * 60_000);
      if (at > now) {
        const data: ReminderData = { date, templateId, kind: 'followup' };
        out.push({ id: idFor(data), at, title: `Still to do: ${title}`, body: `This was due at ${formatMinutes(mins)}.`, data });
      }
    }
  };

  // Today: use the snapshot so done tasks are skipped.
  for (const t of await getDayTasks(today)) {
    if (!t.doneAt && t.templateId != null) push(today, t.templateId, t.title, t.timeMinutes);
  }
  // Future days: straight from the template.
  for (let i = 1; i < days; i++) {
    const date = addDays(today, i);
    for (const t of template.filter((x) => x.weekday === weekdayOf(date))) push(date, t.id, t.title, t.timeMinutes);
  }
  return out;
}

let chain: Promise<void> = Promise.resolve();

/** Re-schedules all reminders. Calls are queued so they never overlap. */
export function syncNotifications(): Promise<void> {
  chain = chain
    .then(async () => {
      const { granted } = await Notifications.getPermissionsAsync();
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!granted) return;
      await configureNotifications();
      await ensureDays();
      for (const p of await plan()) {
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: {
            title: p.title,
            body: p.body,
            data: p.data,
            categoryIdentifier: CATEGORY_ID,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL_ID },
        });
      }
    })
    .catch((e) => console.warn('syncNotifications failed', e));
  return chain;
}

/** Shared by the foreground listener and the background task. */
export async function handleNotificationResponse(response: Notifications.NotificationResponse) {
  if (response.actionIdentifier !== ACTION_DONE) return false;
  const data = response.notification.request.content.data as Partial<ReminderData> | undefined;
  if (!data?.date || data.templateId == null) return false;
  await ensureDays();
  await setDoneByTemplate(data.date, Number(data.templateId));
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  await syncNotifications(); // removes the follow-up for this task
  return true;
}
