import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PushOffer } from '@/components/association';
import { PendingPolls } from '@/components/pending-polls';
import { UpcomingEvents } from '@/components/upcoming-events';
import { BrandBand } from '@/components/brand-band';
import { ActuCard } from '@/components/cards';
import { ChipBar } from '@/components/ui/chip-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { ACTU_CATEGORIES } from '@/lib/categories';
import { useActus } from '@/lib/data';
import { useMember } from '@/lib/session';
import { useBandListStyle } from '@/theme';

type Category = (typeof ACTU_CATEGORIES)[number];

export default function ActusScreen() {
  const [category, setCategory] = useState<Category>('Tous');
  const { branding } = useMember();
  const bandStyle = useBandListStyle();
  const actus = useActus(category);
  const { refreshing, onRefresh } = usePullToRefresh(actus.refetch);
  const items = actus.data?.pages.flat() ?? [];

  return (
    <FlatList
      style={bandStyle}
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => <ActuCard actu={item} index={index} />}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <BrandBand title={(branding?.tenant_name ?? branding?.name ?? 'Actus').toUpperCase()}>
            <ChipBar onBand options={ACTU_CATEGORIES} value={category} onChange={setCategory} />
          </BrandBand>
          <PendingPolls />
          <PushOffer />
          {(category === 'Tous' || category === 'Événement') && <UpcomingEvents />}
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
  content: { paddingTop: 0, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  gap: { height: 12 },
  more: { marginTop: 16 },
});
