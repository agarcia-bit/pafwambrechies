import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { DateTile } from '@/components/actu-visual';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { addToCalendar } from '@/lib/calendar';
import { useEvenements } from '@/lib/data';
import { venue } from '@/lib/format';
import { useSeenEvents } from '@/lib/seen-events';
import { useTenantConfig } from '@/lib/tenant-config';
import type { Evenement } from '@/lib/types';

const MAX_SHOWN = 3;

/**
 * The next events of the Agenda, as cards at the top of the news feed, each with
 * "add to my calendar" and "seen" (which removes it from the feed only).
 */
export function UpcomingEvents() {
  const { modules } = useTenantConfig();
  const events = useEvenements();
  const { seen, markSeen } = useSeenEvents();
  const shown = (events.data ?? []).filter((ev) => !seen.includes(ev.id)).slice(0, MAX_SHOWN);
  if (!modules.agenda || !shown.length) return null;

  return (
    <View style={styles.block}>
      <Text variant="headline" style={styles.title}>
        À venir
      </Text>
      {shown.map((ev) => (
        <Animated.View key={ev.id} exiting={FadeOut.duration(220)} layout={LinearTransition}>
          <EventCard
            event={ev}
            onSeen={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              markSeen(ev.id);
            }}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function EventCard({ event: ev, onSeen }: { event: Evenement; onSeen: () => void }) {
  const details = [ev.heure, venue(ev.lieu)].filter(Boolean).join(' · ');
  return (
    <PressableCard
      style={styles.card}
      accessibilityLabel={ev.titre}
      onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: String(ev.id) } })}>
      <View style={styles.head}>
        <DateTile date={ev.date} onCard />
        <View style={styles.text}>
          <Text variant="headline" numberOfLines={2}>
            {ev.titre}
          </Text>
          {!!details && (
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {details}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {Platform.OS !== 'web' && (
          <Button compact variant="secondary" icon="calendarAdd" title="Ajouter à l’agenda" onPress={() => addToCalendar(ev)} />
        )}
        <Button compact variant="plain" icon="check" title="Vu" onPress={onSeen} />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  title: { marginHorizontal: 16 },
  card: { marginHorizontal: 16, marginBottom: 2, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
