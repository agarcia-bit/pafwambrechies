import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { BrandBand } from '@/components/brand-band';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { ChipBar } from '@/components/ui/chip-bar';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAnnuaire } from '@/lib/data';
import { fullName, searchable } from '@/lib/format';
import { useTenantConfig } from '@/lib/tenant-config';
import type { Commercant } from '@/lib/types';
import { useBandListStyle, useTheme } from '@/theme';

export default function AnnuaireScreen() {
  const annuaire = useAnnuaire();
  const bandStyle = useBandListStyle();
  const { categories, labels } = useTenantConfig();
  const [category, setCategory] = useState('Tous');
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
      <FlatList
        style={bandStyle}
        data={items}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <MerchantRow merchant={item} />}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={styles.header}>
            <BrandBand title={labels.annuaire}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher"
                placeholderTextColor="rgba(255,255,255,0.75)"
                selectionColor="#FFFFFF"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={styles.search}
              />
              {categories.annuaire.length > 0 && (
                <ChipBar onBand options={['Tous', ...categories.annuaire]} value={category} onChange={setCategory} />
              )}
            </BrandBand>
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
  const { categories } = useTenantConfig();
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
        {categories.annuaire.length > 0 && <Badge label={m.categorie} />}
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 16 },
  search: {
    marginHorizontal: 16,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  rowText: { flex: 1, gap: 4 },
  gap: { height: 8 },
});
