import { router } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { DateTile } from '@/components/actu-visual';
import { BrandBand } from '@/components/brand-band';
import { PressableCard } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useEvenements } from '@/lib/data';
import { dayParts, monthLabel, venue } from '@/lib/format';
import type { Evenement } from '@/lib/types';
import { useBandListStyle, useTheme } from '@/theme';

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
  const bandStyle = useBandListStyle();
  const { refreshing, onRefresh } = usePullToRefresh(events.refetch);

  return (
    <SectionList
      style={bandStyle}
      ListHeaderComponent={<BrandBand title="Agenda" />}
      sections={byMonth(events.data ?? [])}
      keyExtractor={(ev) => String(ev.id)}
      renderItem={({ item }) => <EventRow event={item} />}
      renderSectionHeader={({ section }) => (
        <Text variant="headline" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      stickySectionHeadersEnabled={false}
      contentInsetAdjustmentBehavior="never"
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
  const details = [ev.heure, venue(ev.lieu)].filter(Boolean).join(' · ');
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={`${ev.titre}, le ${day} ${month}`}
      onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: String(ev.id) } })}>
      <View style={[styles.date, { borderColor: colors.separator }]}>
        <DateTile date={ev.date} large />
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
  content: { paddingTop: 0, paddingBottom: 32 },
  sectionTitle: { marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  // White like the iPhone Calendar icon: a hairline and a soft shadow set it apart on the white card.
  date: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  rowText: { flex: 1, gap: 2 },
  gap: { height: 8 },
});
