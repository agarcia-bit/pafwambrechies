import { useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useEvenements } from '@/lib/data';
import { fullName } from '@/lib/format';
import { useParticipants, type Participant, type Reponse } from '@/lib/participation';
import {
  compterPresentsParJour,
  estSurPlusieursJours,
  formatJourCourt,
  formatPeriode,
  joursDeLEvenement,
  resumerJoursChoisis,
} from '@/lib/periode';
import type { Evenement } from '@/lib/types';

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
          {formatPeriode(ev)}
        </Text>
      )}
      <Text tone="secondary">
        {inGroup('present').length} présents · {inGroup('absent').length} absents · {inGroup(null).length} sans réponse
      </Text>
      {!!ev && estSurPlusieursJours(ev) && <PresentsParJour event={ev} participants={members} />}
      {GROUPS.map(({ key, title }) => {
        const group = inGroup(key);
        if (!group.length) return null;
        return (
          <ListSection key={title} title={`${title} (${group.length})`}>
            {group.map((m) => (
              <ListRow key={m.id} title={name(m)} subtitle={detailDeLaPresence(m, ev)} />
            ))}
          </ListSection>
        );
      })}
    </ScrollView>
  );
}

/** Pour un présent à un événement sur plusieurs jours : ses jours, et son mot s'il en a laissé un. */
function detailDeLaPresence(m: Participant, ev: Evenement | undefined): string | undefined {
  if (m.reponse !== 'present' || !ev || !estSurPlusieursJours(ev)) return undefined;
  return [resumerJoursChoisis(m.jours), m.precision && `« ${m.precision} »`].filter(Boolean).join(' · ');
}

function PresentsParJour({ event: ev, participants }: { event: Evenement; participants: Participant[] }) {
  return (
    <ListSection title="Présents par jour">
      {compterPresentsParJour(joursDeLEvenement(ev), participants).map(({ jour, presents }) => (
        <ListRow key={jour} title={formatJourCourt(jour)} value={String(presents)} hideChevron />
      ))}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  date: { marginTop: -16 },
});
