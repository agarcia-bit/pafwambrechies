import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { adminErrorMessage } from '@/lib/admin';
import { confirmAction, showMessage } from '@/lib/confirm';
import { formatRelative } from '@/lib/format';
import { KIND_LABELS, useHandleReport, usePendingReports, type PendingReport } from '@/lib/moderation';

// Reports waiting for the bureau: delete the reported content, or close the report.
export default function SignalementsScreen() {
  const reports = usePendingReports();
  const { refreshing, onRefresh } = usePullToRefresh(reports.refetch);

  return (
    <FlatList
      data={reports.data ?? []}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <ReportCard report={item} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <Text tone="secondary" style={styles.intro}>
          Examinez chaque signalement rapidement : supprimez le contenu s’il ne respecte pas les règles, sinon classez-le.
        </Text>
      }
      ListEmptyComponent={
        reports.isPending ? (
          <LoadingState />
        ) : reports.isError ? (
          <ErrorState onRetry={reports.refetch} />
        ) : (
          <EmptyState icon="flag" title="Aucun signalement" message="Tout est en ordre." />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function ReportCard({ report: r }: { report: PendingReport }) {
  const handle = useHandleReport();

  async function act(remove: boolean) {
    const ok = await confirmAction({
      title: remove ? 'Supprimer ce contenu ?' : 'Classer ce signalement ?',
      message: remove ? 'Le contenu est supprimé définitivement et le signalement classé.' : 'Le contenu reste en place.',
      confirmLabel: remove ? 'Supprimer' : 'Classer',
      destructive: remove,
    });
    if (ok) handle.mutate({ report: r, remove }, { onError: (e) => showMessage('Action impossible', adminErrorMessage(e)) });
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Badge label={KIND_LABELS[r.kind]} />
        <Text variant="footnote" tone="secondary" style={styles.when}>
          {formatRelative(r.created_at)}
        </Text>
      </View>
      <Text variant="footnote" tone="secondary">
        Motif : {r.reason}
        {r.reporter_nom ? ` · signalé par ${r.reporter_nom}` : ''}
      </Text>
      {r.contenu ? (
        <Text numberOfLines={8}>{r.contenu}</Text>
      ) : (
        <Text tone="secondary">Le contenu n’existe plus.</Text>
      )}
      {!!r.auteur_nom && (
        <Text variant="footnote" tone="secondary">
          Auteur : {r.auteur_nom}
        </Text>
      )}
      <View style={styles.actions}>
        {!!r.contenu && (
          <Button title="Supprimer le contenu" variant="destructive" compact onPress={() => act(true)} loading={handle.isPending} />
        )}
        <Button title="Classer" variant="secondary" compact onPress={() => act(false)} loading={handle.isPending} />
      </View>
    </Card>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  intro: { marginBottom: 12 },
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  when: { flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  gap: { height: 10 },
});
