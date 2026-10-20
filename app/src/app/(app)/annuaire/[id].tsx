import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { DetailCard, DetailRow, DetailStatus, FullScreenDetail, Rise } from '@/components/full-screen-detail';
import { Avatar } from '@/components/ui/avatar';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAnnuaire } from '@/lib/data';
import { fullName } from '@/lib/format';
import { externalUrl, instagramUrl, mapsUrl, openLink, phoneUrl } from '@/lib/links';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

// Hero in the association's color with the member's photo or logo beside the name, then the
// description and the ways to reach them on a white sheet.
export default function CommercantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const annuaire = useAnnuaire();
  const { colors } = useTheme();
  const { categories } = useTenantConfig();
  const m = annuaire.data?.find((item) => item.id === Number(id));

  if (annuaire.isPending || !m) {
    return (
      <DetailStatus>
        {annuaire.isPending ? (
          <LoadingState />
        ) : annuaire.isError ? (
          <ErrorState onRetry={annuaire.refetch} />
        ) : (
          <EmptyState title="Fiche introuvable" message="Elle a peut-être été supprimée." />
        )}
      </DetailStatus>
    );
  }

  const contact = fullName(m.prenom_contact, m.nom_contact);
  const name = m.nom_entreprise || contact;
  const hasContacts = !!(m.adresse || m.telephone || m.email || m.linkedin || m.instagram);

  return (
    <FullScreenDetail
      color={colors.banner}
      label={categories.annuaire.length > 0 ? m.categorie : undefined}
      title={name}
      subtitle={contact && m.nom_entreprise ? contact : undefined}
      leading={
        m.photo_url ? (
          <Image
            source={{ uri: m.photo_url }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`Photo de ${name}`}
          />
        ) : (
          <Avatar name={name} size={72} />
        )
      }>
      {!!m.description && (
        <Rise>
          <LinkedText>{m.description}</LinkedText>
        </Rise>
      )}
      {hasContacts && (
        <Rise order={1}>
          <DetailCard>
            {!!m.adresse && (
              <DetailRow
                icon="location"
                text={m.adresse}
                hint="Itinéraire"
                onPress={() => openLink(mapsUrl(m.adresse!), { inApp: false })}
              />
            )}
            {!!m.telephone && (
              <DetailRow
                icon="phone"
                text={m.telephone}
                hint="Appeler"
                onPress={() => openLink(phoneUrl(m.telephone!), { inApp: false })}
              />
            )}
            {!!m.email && (
              <DetailRow icon="mail" text={m.email} hint="Écrire" onPress={() => openLink(`mailto:${m.email}`, { inApp: false })} />
            )}
            {!!m.linkedin && (
              <DetailRow
                icon="briefcase"
                text="LinkedIn"
                hint="Ouvrir"
                onPress={() => openLink(externalUrl(m.linkedin!), { inApp: false })}
              />
            )}
            {!!m.instagram && (
              <DetailRow
                icon="camera"
                text={m.instagram}
                hint="Instagram"
                onPress={() => openLink(instagramUrl(m.instagram!), { inApp: false })}
              />
            )}
          </DetailCard>
        </Rise>
      )}
    </FullScreenDetail>
  );
}

const styles = StyleSheet.create({
  photo: { width: 72, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
});
