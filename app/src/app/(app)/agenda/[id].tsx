import { useLocalSearchParams } from 'expo-router';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { addToCalendar } from '@/lib/calendar';
import { useEvenements } from '@/lib/data';
import { formatDayLong } from '@/lib/format';
import { mapsUrl, openLink } from '@/lib/links';

export default function EvenementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useEvenements();
  const ev = events.data?.find((item) => item.id === Number(id));

  if (events.isPending) return <LoadingState />;
  if (!ev) {
    return events.isError ? (
      <ErrorState onRetry={events.refetch} />
    ) : (
      <EmptyState title="Événement introuvable" message="Il est peut-être passé ou a été supprimé." />
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text variant="title" selectable>
        {ev.titre}
      </Text>
      <ListSection>
        <ListRow icon="calendar" title={formatDayLong(ev.date)} />
        {ev.heure && <ListRow icon="clock" title={ev.heure} />}
        {ev.lieu && (
          <ListRow
            icon="location"
            title={ev.lieu}
            subtitle="Itinéraire"
            onPress={() => openLink(mapsUrl(ev.lieu!), { inApp: false })}
          />
        )}
      </ListSection>
      {!!ev.description && <Text selectable>{ev.description}</Text>}
      {Platform.OS !== 'web' && (
        <Button title="Ajouter à mon agenda" icon="calendarAdd" variant="secondary" onPress={() => addToCalendar(ev)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
});
