import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useLiens } from '@/lib/data';
import { grouperParCategorie } from '@/lib/grouper-par-categorie';
import { externalUrl, openLink } from '@/lib/links';
import { useTheme } from '@/theme';

const SANS_CATEGORIE = 'Autres liens';

export default function LiensScreen() {
  const liens = useLiens();
  const { colors } = useTheme();
  const { refreshing, onRefresh } = usePullToRefresh(liens.refetch);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {liens.isPending ? (
        <LoadingState />
      ) : liens.isError ? (
        <ErrorState onRetry={liens.refetch} />
      ) : !liens.data.length ? (
        <EmptyState icon="link" title="Aucun lien pour le moment" />
      ) : (
        grouperParCategorie(liens.data, SANS_CATEGORIE).map((g) => (
          <ListSection key={g.titre ?? 'all'} title={g.titre}>
            {g.elements.map((l) => (
              <ListRow
                key={l.id}
                icon="link"
                title={l.titre}
                subtitle={l.description ?? undefined}
                onPress={() => openLink(externalUrl(l.url))}
                right={<Icon name="external" size={16} color={colors.textSecondary} />}
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
