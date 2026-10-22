import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { adminErrorMessage, useAdminIdees, useDeleteIdee, type IdeeRow } from '@/lib/admin';
import { confirmAction, showMessage } from '@/lib/confirm';
import { formatRelative } from '@/lib/format';
import { useTheme } from '@/theme';

// Moderation: ideas are published right away, the admin can remove them.
export default function AdminIdeesScreen() {
  const idees = useAdminIdees();
  const { refreshing, onRefresh } = usePullToRefresh(idees.refetch);

  return (
    <FlatList
      data={idees.data ?? []}
      keyExtractor={(i) => String(i.id)}
      renderItem={({ item }) => <IdeeItem idee={item} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <Text tone="secondary" style={styles.intro}>
          Les idées sont publiées dès leur envoi. Supprimez celles qui n’ont pas leur place ici.
        </Text>
      }
      ListEmptyComponent={
        idees.isPending ? (
          <LoadingState />
        ) : idees.isError ? (
          <ErrorState onRetry={idees.refetch} />
        ) : (
          <EmptyState icon="lightbulb" title="Aucune idée" />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function IdeeItem({ idee }: { idee: IdeeRow }) {
  const { colors } = useTheme();
  const remove = useDeleteIdee();
  const title = idee.titre || idee.texte;

  async function destroy() {
    const ok = await confirmAction({
      title: 'Supprimer cette idée ?',
      message: 'Ses « j’aime » et ses commentaires seront aussi supprimés.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) remove.mutate(idee.id, { onError: (e) => showMessage('Suppression impossible', adminErrorMessage(e)) });
  }

  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: '/plus/idees/[id]', params: { id: String(idee.id) } })}>
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="footnote" tone="secondary">
          {idee.prenom || 'Anonyme'} · {formatRelative(idee.created_at)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Supprimer l’idée"
        hitSlop={10}
        disabled={remove.isPending}
        onPress={destroy}>
        <Icon name="trash" size={20} color={colors.danger} />
      </Pressable>
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  intro: { marginHorizontal: 16, marginBottom: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowText: { flex: 1, gap: 3 },
  gap: { height: 8 },
});
