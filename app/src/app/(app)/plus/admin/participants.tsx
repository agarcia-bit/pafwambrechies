import { useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useEvenements } from '@/lib/data';
import { formatDayLong, fullName } from '@/lib/format';
import { useParticipants, type Participant, type Reponse } from '@/lib/participation';

const GROUPS: { key: Reponse | null; title: string }[] = [
  { key: 'present', title: 'Présents' },
  { key: 'indecis', title: 'Ne savent pas encore' },
  { key: 'absent', title: 'Absents' },
  { key: null, title: 'Sans réponse' },
];

// The bureau sees who comes to an event, by name, and who still has to answer.
export default function ParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const evenementId = Number(id);
  const participants = useParticipants(evenementId);
  const events = useEvenements();
  const { refreshing, onRefresh } = usePullToRefresh(participants.refetch);
  const ev = events.data?.find((e) => e.id === evenementId);

  if (participants.isPending) return <LoadingState />;
  if (participants.isError) return <ErrorState onRetry={participants.refetch} />;
  const members = participants.data;
  if (!members.length) return <EmptyState icon="people" title="Aucun adhérent" />;

  const inGroup = (key: Reponse | null) => members.filter((m) => m.reponse === key);
  const name = (m: Participant) => fullName(m.prenom, m.nom) || 'Adhérent';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text variant="headline">{ev?.titre ?? 'Événement'}</Text>
      {!!ev && (
        <Text tone="secondary" style={styles.date}>
          {formatDayLong(ev.date)}
        </Text>
      )}
      <Text tone="secondary">
        {inGroup('present').length} présents · {inGroup('absent').length} absents · {inGroup(null).length} sans réponse
      </Text>
      {GROUPS.map(({ key, title }) => {
        const group = inGroup(key);
        if (!group.length) return null;
        return (
          <ListSection key={title} title={`${title} (${group.length})`}>
            {group.map((m) => (
              <ListRow key={m.id} title={name(m)} />
            ))}
          </ListSection>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  date: { marginTop: -16 },
});
