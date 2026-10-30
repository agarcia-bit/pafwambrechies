import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { confirmAction, showMessage } from '@/lib/confirm';
import { fileSize, openDocument, useDocuments, useRemoveDocument, type Doc } from '@/lib/documents';
import { formatDay } from '@/lib/format';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

const OTHER = 'Autres documents';

function group(docs: Doc[]): { title?: string; docs: Doc[] }[] {
  if (!docs.some((d) => d.categorie)) return [{ docs }];
  const byCategory = new Map<string, Doc[]>();
  for (const d of docs) byCategory.set(d.categorie ?? OTHER, [...(byCategory.get(d.categorie ?? OTHER) ?? []), d]);
  return [...byCategory]
    .sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b, 'fr')))
    .map(([title, list]) => ({ title, docs: list }));
}

export default function DocumentsScreen() {
  const docs = useDocuments();
  const remove = useRemoveDocument();
  const { isBureau } = useMember();
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh(docs.refetch);

  async function confirmRemove(doc: Doc) {
    const ok = await confirmAction({
      title: 'Supprimer ce document ?',
      message: `« ${doc.titre} » ne sera plus accessible aux adhérents.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) remove.mutate(doc, { onError: () => showMessage('Suppression impossible', 'Réessayez dans un instant.') });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {isBureau && (
        <Button title="Ajouter un document" icon="plus" onPress={() => router.push('/plus/admin/document-nouveau')} />
      )}
      {docs.isPending ? (
        <LoadingState />
      ) : docs.isError ? (
        <ErrorState onRetry={docs.refetch} />
      ) : !docs.data.length ? (
        <EmptyState
          icon="document"
          title="Aucun document pour le moment"
          message={isBureau ? 'Ajoutez les statuts, comptes rendus ou formulaires à partager.' : undefined}
        />
      ) : (
        group(docs.data).map((g) => (
          <ListSection key={g.title ?? 'all'} title={g.title}>
            {g.docs.map((d) => (
              <ListRow
                key={d.id}
                icon="document"
                title={d.titre}
                subtitle={[formatDay(d.created_at.slice(0, 10)), fileSize(d.taille)].filter(Boolean).join(' · ')}
                onPress={() => openDocument(d)}
                hideChevron={isBureau}
                right={
                  isBureau ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer ${d.titre}`}
                      hitSlop={10}
                      onPress={() => confirmRemove(d)}>
                      <Icon name="trash" size={18} color={colors.danger} />
                    </Pressable>
                  ) : undefined
                }
              />
            ))}
          </ListSection>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 20, flexGrow: 1 },
});
