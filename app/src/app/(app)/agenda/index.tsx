import { router } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { PressableCard } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useEvenements } from '@/lib/data';
import { dayParts, monthLabel } from '@/lib/format';
import type { Evenement } from '@/lib/types';
import { useTheme } from '@/theme';

function byMonth(events: Evenement[]): { title: string; data: Evenement[] }[] {
  const sections: { title: string; data: Evenement[] }[] = [];
  for (const ev of events) {
    const title = monthLabel(ev.date);
    const last = sections.at(-1);
    if (last?.title === title) last.data.push(ev);
    else sections.push({ title, data: [ev] });
  }
  return sections;
}

export default function AgendaScreen() {
  const events = useEvenements();
  const { refreshing, onRefresh } = usePullToRefresh(events.refetch);

  return (
    <SectionList
      sections={byMonth(events.data ?? [])}
      keyExtractor={(ev) => String(ev.id)}
      renderItem={({ item }) => <EventRow event={item} />}
      renderSectionHeader={({ section }) => (
        <Text variant="headline" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      stickySectionHeadersEnabled={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListEmptyComponent={
        events.isPending ? (
          <LoadingState />
        ) : events.isError ? (
          <ErrorState onRetry={events.refetch} />
        ) : (
          <EmptyState icon="calendar" title="Aucun événement à venir" />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function EventRow({ event: ev }: { event: Evenement }) {
  const { colors } = useTheme();
  const { day, month } = dayParts(ev.date);
  const details = [ev.heure, ev.lieu].filter(Boolean).join(' · ');
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={`${ev.titre}, le ${day} ${month}`}
      onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: String(ev.id) } })}>
      <View style={[styles.date, { backgroundColor: colors.primarySoft }]}>
        <Text variant="title" tone="primary" style={styles.day}>
          {day}
        </Text>
        <Text variant="caption" tone="primary">
          {month}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text variant="headline">{ev.titre}</Text>
        {!!details && (
          <Text variant="subhead" tone="secondary">
            {details}
          </Text>
        )}
      </View>
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  sectionTitle: { marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  date: { width: 56, height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  day: { lineHeight: 26 },
  rowText: { flex: 1, gap: 2 },
  gap: { height: 8 },
});
