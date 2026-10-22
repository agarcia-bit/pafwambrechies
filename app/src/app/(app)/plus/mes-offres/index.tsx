import { router, Stack } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useMyOffres } from '@/lib/data';
import { offerValidity } from '@/lib/format';
import type { Offre } from '@/lib/types';
import { useTheme } from '@/theme';

const propose = () => router.push('/plus/mes-offres/edit');

// The offers the member proposed: a proposal is published by the bureau after a check.
export default function MesOffresScreen() {
  const offres = useMyOffres();
  const { refreshing, onRefresh } = usePullToRefresh(offres.refetch);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Proposer une offre" hitSlop={10} onPress={propose}>
              <Icon name="plus" size={22} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={offres.data ?? []}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <OffreRow offre={item} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text tone="secondary" style={styles.intro}>
              Proposez une offre aux adhérents. Elle est publiée après validation par le bureau.
            </Text>
            <Button title="Proposer une offre" icon="plus" variant="secondary" onPress={propose} style={styles.add} />
          </View>
        }
        ListEmptyComponent={
          offres.isPending ? (
            <LoadingState />
          ) : offres.isError ? (
            <ErrorState onRetry={offres.refetch} />
          ) : (
            <EmptyState icon="tag" title="Aucune offre proposée" message="Vos propositions apparaîtront ici." />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function OffreRow({ offre: o }: { offre: Offre }) {
  const { colors } = useTheme();
  const pending = o.statut === 'en_attente';
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={o.titre}
      onPress={() => router.push({ pathname: '/plus/mes-offres/edit', params: { id: String(o.id) } })}>
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={2}>
          {o.titre}
        </Text>
        <Text variant="footnote" tone="secondary">
          {offerValidity(o.expiration)}
        </Text>
        <View style={styles.badges}>
          <Badge label={pending ? 'En attente de validation' : 'Publiée'} />
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
  header: { gap: 12, marginBottom: 16 },
  intro: { marginHorizontal: 20 },
  add: { marginHorizontal: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  gap: { height: 8 },
});
