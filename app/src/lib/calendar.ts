// The object API of expo-calendar is not available in Expo Go: use the legacy one.
import { createEventInCalendarAsync, requestCalendarPermissionsAsync } from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { showMessage } from '@/lib/confirm';
import { parseDay, venue } from '@/lib/format';
import { dernierJour } from '@/lib/periode';
import type { Evenement } from '@/lib/types';

/**
 * Start and end of an event from its "HH:MM – HH:MM" text; all-day when there is no time.
 * Un événement sur plusieurs jours commence le premier jour et finit le dernier.
 */
function eventDates(ev: Evenement): { startDate: Date; endDate: Date; allDay: boolean } {
  const day = parseDay(ev.date);
  const lastDay = parseDay(dernierJour(ev));
  const [debut, fin] = [...(ev.heure ?? '').matchAll(/(\d{1,2})\s*[:hH]\s*(\d{2})?/g)].map(([, h, m]) => ({
    h: Number(h),
    m: Number(m ?? 0),
  }));
  if (!debut) return { startDate: day, endDate: lastDay, allDay: true };
  const startDate = new Date(day);
  startDate.setHours(debut.h, debut.m);
  const endDate = new Date(lastDay);
  if (fin) endDate.setHours(fin.h, fin.m);
  else endDate.setHours(debut.h + 1, debut.m);
  return { startDate, endDate: endDate > startDate ? endDate : new Date(startDate.getTime() + 60 * 60 * 1000), allDay: false };
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
      location: venue(ev.lieu) ?? undefined,
      notes: ev.description ?? undefined,
    });
  } catch {
    showMessage("Impossible d'ouvrir le calendrier.");
  }
}
