import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { ChipBar } from '@/components/ui/chip-bar';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { ANNUAIRE_CATEGORIES } from '@/lib/categories';
import { useAnnuaire } from '@/lib/data';
import { fullName, searchable } from '@/lib/format';
import type { Commercant } from '@/lib/types';
import { useTheme } from '@/theme';

type Category = (typeof ANNUAIRE_CATEGORIES)[number];

export default function AnnuaireScreen() {
  const annuaire = useAnnuaire();
  const { colors } = useTheme();
  const [category, setCategory] = useState<Category>('Tous');
  const [search, setSearch] = useState('');
  const { refreshing, onRefresh } = usePullToRefresh(annuaire.refetch);

  const query = searchable(search);
  const items = (annuaire.data ?? []).filter(
    (m) =>
      (category === 'Tous' || m.categorie === category) &&
      (!query ||
        searchable([m.nom_entreprise, m.prenom_contact, m.nom_contact, m.description].filter(Boolean).join(' ')).includes(
          query
        ))
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Rechercher',
            onChangeText: (e) => setSearch(e.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
          },
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <MerchantRow merchant={item} />}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={styles.header}>
            {Platform.OS === 'web' && (
              // The native header search bar does not exist on web.
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher"
                placeholderTextColor={colors.textSecondary}
                style={[styles.webSearch, { backgroundColor: colors.fill, color: colors.text }]}
              />
            )}
            <ChipBar options={ANNUAIRE_CATEGORIES} value={category} onChange={setCategory} />
          </View>
        }
        ListEmptyComponent={
          annuaire.isPending ? (
            <LoadingState />
          ) : annuaire.isError ? (
            <ErrorState onRetry={annuaire.refetch} />
          ) : (
            <EmptyState icon="people" title="Aucun résultat" />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </>
  );
}

function MerchantRow({ merchant: m }: { merchant: Commercant }) {
  const { colors } = useTheme();
  const contact = fullName(m.prenom_contact, m.nom_contact);
  return (
    <PressableCard
      style={styles.row}
      accessibilityLabel={m.nom_entreprise || contact}
      onPress={() => router.push({ pathname: '/annuaire/[id]', params: { id: String(m.id) } })}>
      <Avatar name={m.nom_entreprise || contact} uri={m.photo_url} size={52} />
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={1}>
          {m.nom_entreprise || contact}
        </Text>
        {!!contact && !!m.nom_entreprise && (
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {contact}
          </Text>
        )}
        <Badge label={m.categorie} />
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
  webSearch: { marginHorizontal: 16, height: 40, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  rowText: { flex: 1, gap: 4 },
  gap: { height: 8 },
});
