import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AssociationBanner, PushOffer } from '@/components/association';
import { ActuCard } from '@/components/cards';
import { ChipBar } from '@/components/ui/chip-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { ACTU_CATEGORIES } from '@/lib/categories';
import { useActus } from '@/lib/data';

type Category = (typeof ACTU_CATEGORIES)[number];

export default function ActusScreen() {
  const [category, setCategory] = useState<Category>('Tous');
  const actus = useActus(category);
  const { refreshing, onRefresh } = usePullToRefresh(actus.refetch);
  const items = actus.data?.pages.flat() ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ActuCard actu={item} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <AssociationBanner />
          <PushOffer />
          <ChipBar options={ACTU_CATEGORIES} value={category} onChange={setCategory} />
        </View>
      }
      ListEmptyComponent={
        actus.isPending ? (
          <LoadingState />
        ) : actus.isError ? (
          <ErrorState onRetry={actus.refetch} />
        ) : (
          <EmptyState icon="newspaper" title="Aucune actualité" message="Les publications de votre association apparaîtront ici." />
        )
      }
      ListFooterComponent={actus.isFetchingNextPage ? <ActivityIndicator style={styles.more} /> : null}
      onEndReached={() => {
        if (actus.hasNextPage && !actus.isFetchingNextPage) actus.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  gap: { height: 12 },
  more: { marginTop: 16 },
});
