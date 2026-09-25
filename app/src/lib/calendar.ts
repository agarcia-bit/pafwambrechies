// The object API of expo-calendar is not available in Expo Go: use the legacy one.
import { createEventInCalendarAsync, requestCalendarPermissionsAsync } from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { showMessage } from '@/lib/confirm';
import { parseDay } from '@/lib/format';
import type { Evenement } from '@/lib/types';

/** Start and end of an event from its "HH:MM – HH:MM" text; all-day when there is no time. */
function eventDates(ev: Evenement): { startDate: Date; endDate: Date; allDay: boolean } {
  const day = parseDay(ev.date);
  const times = [...(ev.heure ?? '').matchAll(/(\d{1,2})\s*[:hH]\s*(\d{2})?/g)].map(([, h, m]) => {
    const date = new Date(day);
    date.setHours(Number(h), Number(m ?? 0));
    return date;
  });
  if (!times.length) return { startDate: day, endDate: day, allDay: true };
  const [startDate, end] = times;
  const endDate = end && end > startDate ? end : new Date(startDate.getTime() + 60 * 60 * 1000);
  return { startDate, endDate, allDay: false };
}

/** Opens the system "new event" sheet, pre-filled (no calendar access needed from iOS 17). */
export async function addToCalendar(ev: Evenement): Promise<void> {
  try {
    if (Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) < 17) {
      const { granted } = await requestCalendarPermissionsAsync();
      if (!granted) {
        showMessage('Accès au calendrier refusé', 'Autorisez-le dans les Réglages pour ajouter cet événement.');
        return;
      }
    }
    await createEventInCalendarAsync({
      title: ev.titre,
      ...eventDates(ev),
      location: ev.lieu ?? undefined,
      notes: ev.description ?? undefined,
    });
  } catch {
    showMessage("Impossible d'ouvrir le calendrier.");
  }
}
