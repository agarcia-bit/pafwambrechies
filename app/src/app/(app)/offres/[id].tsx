import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { OfferTag } from '@/components/offer-tag';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useAnnuaire, useOffres } from '@/lib/data';
import { offerValidity, searchable } from '@/lib/format';

export default function OffreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offres = useOffres();
  const annuaire = useAnnuaire();
  const o = offres.data?.find((item) => item.id === Number(id));

  if (offres.isPending) return <LoadingState />;
  if (!o) {
    return offres.isError ? (
      <ErrorState onRetry={offres.refetch} />
    ) : (
      <EmptyState title="Offre introuvable" message="Elle a peut-être expiré." />
    );
  }

  // Offers name the merchant as free text: link to the directory when it matches.
  const merchant = annuaire.data?.find((m) => searchable(m.nom_entreprise) === searchable(o.commercant));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {!!o.tag && <OfferTag label={o.tag} />}
      <View style={styles.head}>
        <Text variant="title" selectable>
          {o.titre}
        </Text>
        <Text tone="secondary">{o.commercant}</Text>
      </View>
      {!!o.description && <Text selectable>{o.description}</Text>}
      <ListSection>
        <ListRow icon="calendar" title={offerValidity(o.expiration)} />
        {merchant && (
          <ListRow
            icon="people"
            title="Voir la fiche du commerçant"
            onPress={() => router.push({ pathname: '/annuaire/[id]', params: { id: String(merchant.id) } })}
          />
        )}
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  head: { gap: 4 },
});
