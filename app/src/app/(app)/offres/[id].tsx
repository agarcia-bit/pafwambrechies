import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DetailCard, DetailRow, DetailStatus, FullScreenDetail, Rise } from '@/components/full-screen-detail';
import { Button } from '@/components/ui/button';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useContentMenu } from '@/lib/moderation';
import { useMember } from '@/lib/session';
import { useAnnuaire, useOffres } from '@/lib/data';
import { offerValidity, searchable } from '@/lib/format';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

// Hero in the association's color with the merchant's name, then the offer on a white sheet.
export default function OffreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const offres = useOffres();
  const annuaire = useAnnuaire();
  const { modules } = useTenantConfig();
  const { colors } = useTheme();
  const openMenu = useContentMenu();
  const { profile } = useMember();
  const o = offres.data?.find((item) => item.id === Number(id));

  if (offres.isPending || !o) {
    return (
      <DetailStatus>
        {offres.isPending ? (
          <LoadingState />
        ) : offres.isError ? (
          <ErrorState onRetry={offres.refetch} />
        ) : (
          <EmptyState title="Offre introuvable" message="Elle a peut-être expiré." />
        )}
      </DetailStatus>
    );
  }

  // Offers name the merchant as free text: link to the directory when it matches.
  const merchant = annuaire.data?.find((m) => searchable(m.nom_entreprise) === searchable(o.commercant));

  return (
    <FullScreenDetail
      color={colors.banner}
      label={o.commercant}
      title={o.titre}
      footer={
        modules.annuaire && merchant ? (
          <Button
            title="Voir la fiche du commerçant"
            icon="people"
            onPress={() => {
              // Close this full-screen offer first: the fiche lives in the directory tab.
              router.back();
              setTimeout(() => router.push({ pathname: '/annuaire/[id]', params: { id: String(merchant.id) } }), 50);
            }}
          />
        ) : undefined
      }>
      {!!o.tag && (
        <Rise>
          <View style={[styles.highlight, { backgroundColor: colors.primary }]}>
            <Text variant="footnote" style={[styles.highlightLabel, { color: colors.onPrimary }]}>
              VOTRE AVANTAGE
            </Text>
            <Text variant="largeTitle" style={[styles.highlightText, { color: colors.onPrimary }]}>
              {o.tag}
            </Text>
          </View>
        </Rise>
      )}
      {!!o.description && (
        <Rise order={1}>
          <LinkedText>{o.description}</LinkedText>
        </Rise>
      )}
      <Rise order={2}>
        <DetailCard>
          <DetailRow icon="calendar" text={offerValidity(o.expiration)} />
          {!!o.user_id && o.user_id !== profile.id && (
            <DetailRow
              icon="flag"
              text="Signaler cette offre"
              onPress={() => openMenu({ kind: 'offre', targetId: o.id, authorId: o.user_id ?? null, authorName: o.commercant })}
            />
          )}
        </DetailCard>
      </Rise>
    </FullScreenDetail>
  );
}

const styles = StyleSheet.create({
  highlight: { borderRadius: 20, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 6 },
  highlightLabel: { fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  highlightText: { fontWeight: '800', textAlign: 'center' },
});
