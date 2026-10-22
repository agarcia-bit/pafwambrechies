import { router, Stack } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { daysUntil, formatDayShort, formatRelative, plural } from '@/lib/format';
import { useAdminSondages, type AdminSondage } from '@/lib/sondages';
import { useTheme } from '@/theme';

const create = () => router.push('/plus/admin/sondages/nouveau');

export default function AdminSondagesScreen() {
  const data = useAdminSondages();
  const { refreshing, onRefresh } = usePullToRefresh(data.refetch);
  const memberCount = data.data?.members.length ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Nouveau sondage" hitSlop={10} onPress={create}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={data.data?.sondages ?? []}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => <SondageRow sondage={item} memberCount={memberCount} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={<Button title="Lancer un sondage" icon="plus" variant="secondary" onPress={create} style={styles.add} />}
        ListEmptyComponent={
          data.isPending ? (
            <LoadingState />
          ) : data.isError ? (
            <ErrorState onRetry={data.refetch} />
          ) : (
            <EmptyState icon="poll" title="Aucun sondage" message="Lancez-en un : les membres sont prévenus par notification." />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function SondageRow({ sondage, memberCount }: { sondage: AdminSondage; memberCount: number }) {
  const { colors } = useTheme();
  const answers = sondage.sondage_reponses.length;
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={sondage.question}
      onPress={() => router.push({ pathname: '/plus/admin/sondages/[id]', params: { id: String(sondage.id) } })}>
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={2}>
          {sondage.question}
        </Text>
        <Text variant="footnote" tone="secondary">
          {plural(answers, 'réponse')} sur {memberCount} · {formatRelative(sondage.created_at)}
        </Text>
        <View style={styles.badges}>
          {sondage.obligatoire && <Badge label="Obligatoire" />}
          {!sondage.actif && <Badge label="Clôturé" />}
          {!!sondage.date_limite && (
            <Badge label={daysUntil(sondage.date_limite) < 0 ? `Terminé le ${formatDayShort(sondage.date_limite)}` : `Jusqu’au ${formatDayShort(sondage.date_limite)}`} />
          )}
        </View>
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  add: { marginHorizontal: 16, marginBottom: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowText: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: 6 },
  gap: { height: 8 },
});
