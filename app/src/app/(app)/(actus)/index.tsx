import { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { PushOffer } from '@/components/association';
import { CotisationBanner } from '@/components/cotisation-banner';
import { ParticipationBanner } from '@/components/participation-banner';
import { PendingPolls } from '@/components/pending-polls';
import { UpcomingEvents } from '@/components/upcoming-events';
import { BrandBand } from '@/components/brand-band';
import { ActuCard } from '@/components/cards';
import { Button } from '@/components/ui/button';
import { ChipBar } from '@/components/ui/chip-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { ACTU_CATEGORIES } from '@/lib/categories';
import { useActus } from '@/lib/data';
import { useReadActus } from '@/lib/read-actus';
import { useMember } from '@/lib/session';
import { useBandListStyle } from '@/theme';

/** "Bonjour Andy" in the morning and afternoon, "Bonsoir Andy" from 6 pm. */
function greeting(firstName: string | null): string {
  const hello = new Date().getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
  return firstName?.trim() ? `${hello} ${firstName.trim()}` : hello;
}

type Category = (typeof ACTU_CATEGORIES)[number];

export default function ActusScreen() {
  const [category, setCategory] = useState<Category>('Tous');
  const { branding, profile } = useMember();
  const bandStyle = useBandListStyle();
  const actus = useActus(category);
  const { refreshing, onRefresh } = usePullToRefresh(actus.refetch);
  const items = actus.data?.pages.flat() ?? [];
  const { isRead, markRead } = useReadActus();
  // Unread news first (newest first), then the ones already read, shrunk to one line.
  const unread = items.filter((a) => !isRead(a.id));
  const read = items.filter((a) => isRead(a.id));
  const sorted = [...unread, ...read];

  return (
    <Animated.FlatList
      style={bandStyle}
      data={sorted}
      keyExtractor={(item) => String(item.id)}
      itemLayoutAnimation={LinearTransition.duration(250)}
      renderItem={({ item, index }) => (
        <View>
          {index === unread.length && (
            <Text variant="footnote" tone="secondary" style={styles.readHeader}>
              DÉJÀ LUES
            </Text>
          )}
          <ActuCard actu={item} index={index} />
        </View>
      )}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <BrandBand
            subtitle={greeting(profile.prenom)}
            title={(branding?.tenant_name ?? branding?.name ?? 'Actus').toUpperCase()}>
            <ChipBar onBand options={ACTU_CATEGORIES} value={category} onChange={setCategory} />
          </BrandBand>
          <CotisationBanner />
          <ParticipationBanner />
          <PendingPolls />
          <PushOffer />
          {(category === 'Tous' || category === 'Événement') && <UpcomingEvents />}
          {unread.length >= 2 && (
            <View style={styles.readAll}>
              <Button compact variant="plain" icon="check" title="Tout marquer comme lu" onPress={() => markRead(...unread.map((a) => a.id))} />
            </View>
          )}
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
      ListFooterComponent={actus.isFetchingNextPage ? <ActivityIndicator style={styles.more} /> : undefined}
      onEndReached={() => {
        if (actus.hasNextPage && !actus.isFetchingNextPage) actus.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
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
  readHeader: { marginHorizontal: 20, marginTop: 8, marginBottom: 8, fontWeight: '600', letterSpacing: 0.5 },
  readAll: { alignItems: 'flex-end', marginHorizontal: 8, marginBottom: -12 },
});
