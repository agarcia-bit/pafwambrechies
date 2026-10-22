import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Postponing a poll, remembered on the phone (see poll-queue.ts), with its reminder
// notification. Kept apart from the session code so both can use it.

export const POSTPONE_DAYS = 3;
export const POSTPONE_MS = POSTPONE_DAYS * 24 * 60 * 60 * 1000;

export type Postponement = { at: number; notificationId: string | null };
export type Postponements = Record<string, Postponement>;

// ── Reminder notification (local: scheduled on the phone) ───────────────────

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Schedules "poll waiting" in 3 days; asks for notification permission if it was never asked. */
export async function scheduleReminder(poll: { id: number; question: string }): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '❗ Sondage en attente',
        body: truncate(poll.question, 120),
        data: { sondage_id: poll.id },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: POSTPONE_MS / 1000 },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string | null) {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or unknown: nothing to cancel.
  }
}

/** Sign-out: the next member of this phone must not get this member's reminders. */
export async function cancelAllReminders(memberId: string | undefined) {
  if (!memberId) return;
  await Promise.all(Object.values(readPostponements(memberId)).map((p) => cancelReminder(p.notificationId)));
}

export const storageKey = (memberId: string) => `allianceo.pollPostponed.${memberId}`;

export function readPostponements(memberId: string): Postponements {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(memberId)) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Postponements = {};
    for (const [id, value] of Object.entries(parsed)) {
      const v = value as Partial<Postponement> | null;
      if (v && typeof v.at === 'number') {
        result[id] = { at: v.at, notificationId: typeof v.notificationId === 'string' ? v.notificationId : null };
      }
    }
    return result;
  } catch {
    return {};
  }
}
