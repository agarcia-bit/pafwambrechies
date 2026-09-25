import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ActionCard, openAction, StatutBadge, TaskRow } from '@/components/bureau';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipBar } from '@/components/ui/chip-bar';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { DONE, isOverdue, memberName, tachesOf, useBureau, type Action, type BureauData } from '@/lib/bureau';
import { formatDayShort, todayISO } from '@/lib/format';
import { useTheme } from '@/theme';

const VIEWS = ['À venir', 'Actions', 'Équipe'] as const;
type BureauView = (typeof VIEWS)[number];

const byDate = (a: Action, b: Action) => a.date_action.localeCompare(b.date_action);
const newAction = () => router.push('/plus/bureau/action/nouvelle');

export default function BureauScreen() {
  const bureau = useBureau();
  const [view, setView] = useState<BureauView>('À venir');
  const { refreshing, onRefresh } = usePullToRefresh(bureau.refetch);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Nouvelle action" hitSlop={10} onPress={newAction}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ChipBar options={VIEWS} value={view} onChange={setView} />
        {bureau.isPending ? (
          <LoadingState />
        ) : bureau.isError ? (
          <ErrorState onRetry={bureau.refetch} />
        ) : view === 'À venir' ? (
          <Upcoming data={bureau.data} />
        ) : view === 'Actions' ? (
          <Actions data={bureau.data} />
        ) : (
          <Team data={bureau.data} />
        )}
      </ScrollView>
    </>
  );
}

// The next five open actions with their open tasks, nothing else (brief: minimal on purpose).
function Upcoming({ data }: { data: BureauData }) {
  const today = todayISO();
  const next = data.actions
    .filter((a) => a.statut !== DONE && a.date_action >= today)
    .sort(byDate)
    .slice(0, 5);
  if (!next.length) {
    return <EmptyState icon="clipboard" title="Aucune action à venir" message="Créez-en une avec le bouton +." />;
  }
  return next.map((a) => (
    <ActionCard key={a.id} action={a} taches={tachesOf(data.taches, a.id)} members={data.members} openOnly />
  ));
}

// Every action with its tasks; finished actions are in the archive.
function Actions({ data }: { data: BureauData }) {
  const [archive, setArchive] = useState<'En cours' | 'Terminées'>('En cours');
  const list = data.actions.filter((a) => (archive === 'Terminées') === (a.statut === DONE)).sort(byDate);
  return (
    <>
      <ChipBar options={['En cours', 'Terminées'] as const} value={archive} onChange={setArchive} />
      <Button title="Nouvelle action" icon="plus" variant="secondary" onPress={newAction} style={styles.inset} />
      {list.length ? (
        list.map((a) => (
          <ActionCard key={a.id} action={a} taches={tachesOf(data.taches, a.id)} members={data.members} canAddTask />
        ))
      ) : (
        <EmptyState icon="clipboard" title={archive === 'Terminées' ? 'Aucune action terminée' : 'Aucune action en cours'} />
      )}
    </>
  );
}

// One card per person: the actions they lead and the tasks they own, plus "Non assigné".
function Team({ data }: { data: BureauData }) {
  const { colors } = useTheme();
  const [showDone, setShowDone] = useState(false);
  const visible = (statut: string) => showDone || statut !== DONE;

  const groups = [...data.members.map((m) => m.id), null]
    .map((id) => ({
      id,
      name: memberName(data.members, id),
      actions: data.actions.filter((a) => a.referent === id && visible(a.statut)).sort(byDate),
      taches: data.taches
        .filter((t) => t.responsable === id && visible(t.statut))
        .sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999')),
    }))
    .filter((g) => g.actions.length || g.taches.length);

  return (
    <>
      <Button
        title={showDone ? 'Masquer les terminés' : 'Afficher les terminés'}
        variant="plain"
        onPress={() => setShowDone(!showDone)}
      />
      {groups.length ? (
        groups.map((g) => (
          <Card key={g.id ?? 'none'} style={styles.card}>
            <View style={styles.person}>
              <Avatar name={g.id ? g.name : '?'} size={32} round />
              <Text variant="headline">{g.name}</Text>
            </View>
            {g.actions.length > 0 && (
              <View style={styles.block}>
                <Text variant="footnote" tone="secondary" style={styles.blockTitle}>
                  ACTIONS RÉFÉRENTES
                </Text>
                {g.actions.map((a) => {
                  const late = isOverdue(a.date_action, a.statut);
                  return (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      onPress={() => openAction(a.id)}
                      style={styles.actionLine}>
                      <View style={styles.flex}>
                        <Text>
                          {a.emoji ? `${a.emoji} ` : ''}
                          {a.titre}
                        </Text>
                        <Text variant="footnote" style={{ color: late ? colors.danger : colors.textSecondary }}>
                          {formatDayShort(a.date_action)}
                          {late ? ' · en retard' : ''}
                        </Text>
                      </View>
                      <StatutBadge statut={a.statut} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            {g.taches.length > 0 && (
              <View style={styles.block}>
                <Text variant="footnote" tone="secondary" style={styles.blockTitle}>
                  TÂCHES ASSIGNÉES
                </Text>
                {g.taches.map((t) => (
                  <TaskRow key={t.id} tache={t} members={data.members} />
                ))}
              </View>
            )}
          </Card>
        ))
      ) : (
        <EmptyState icon="clipboard" title="Aucune action ni tâche" />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 40, gap: 12 },
  inset: { marginHorizontal: 16 },
  card: { marginHorizontal: 16, gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  block: { gap: 10 },
  blockTitle: { letterSpacing: 0.5 },
  actionLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
