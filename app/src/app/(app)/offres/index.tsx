import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { OfferTag } from '@/components/offer-tag';
import { PressableCard } from '@/components/ui/card';
import { ChipBar } from '@/components/ui/chip-bar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { OFFRE_CATEGORIES } from '@/lib/categories';
import { useOffres } from '@/lib/data';
import { offerValidity } from '@/lib/format';
import type { Offre } from '@/lib/types';

type Category = (typeof OFFRE_CATEGORIES)[number];

export default function OffresScreen() {
  const offres = useOffres();
  const [category, setCategory] = useState<Category>('Tous');
  const { refreshing, onRefresh } = usePullToRefresh(offres.refetch);
  const items = (offres.data ?? []).filter((o) => category === 'Tous' || o.categorie === category);

  return (
    <FlatList
      data={items}
      keyExtractor={(o) => String(o.id)}
      renderItem={({ item }) => <OffreCard offre={item} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text tone="secondary" style={styles.intro}>
            Les bons plans réservés aux adhérents.
          </Text>
          <ChipBar options={OFFRE_CATEGORIES} value={category} onChange={setCategory} />
        </View>
      }
      ListEmptyComponent={
        offres.isPending ? (
          <LoadingState />
        ) : offres.isError ? (
          <ErrorState onRetry={offres.refetch} />
        ) : (
          <EmptyState icon="tag" title="Aucune offre en cours" />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function OffreCard({ offre: o }: { offre: Offre }) {
  return (
    <PressableCard
      style={styles.card}
      accessibilityLabel={`${o.titre}, ${o.commercant}`}
      onPress={() => router.push({ pathname: '/offres/[id]', params: { id: String(o.id) } })}>
      <Text variant="footnote" tone="secondary" style={styles.merchant}>
        {o.commercant.toUpperCase()}
      </Text>
      <Text variant="headline">{o.titre}</Text>
      <View style={styles.footer}>
        <Text variant="footnote" tone="secondary" style={styles.flex}>
          {offerValidity(o.expiration)}
        </Text>
        {!!o.tag && <OfferTag label={o.tag} />}
      </View>
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 16 },
  intro: { marginHorizontal: 16 },
  card: { marginHorizontal: 16, gap: 6 },
  merchant: { fontWeight: '600', letterSpacing: 0.5 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  flex: { flex: 1 },
  gap: { height: 12 },
});
