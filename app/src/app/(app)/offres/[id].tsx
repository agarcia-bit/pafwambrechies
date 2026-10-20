import { router, useLocalSearchParams } from 'expo-router';

import { DetailCard, DetailRow, DetailStatus, FullScreenDetail, Rise } from '@/components/full-screen-detail';
import { OfferTag } from '@/components/offer-tag';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
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
    <FullScreenDetail color={colors.banner} label={o.commercant} title={o.titre}>
      {!!o.tag && (
        <Rise>
          <OfferTag label={o.tag} />
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
          {modules.annuaire && merchant && (
            <DetailRow
              icon="people"
              text={merchant.nom_entreprise}
              hint="Voir la fiche"
              onPress={() => {
                // Close this full-screen offer first: the fiche lives in the directory tab.
                router.back();
                setTimeout(() => router.push({ pathname: '/annuaire/[id]', params: { id: String(merchant.id) } }), 50);
              }}
            />
          )}
        </DetailCard>
      </Rise>
    </FullScreenDetail>
  );
}
