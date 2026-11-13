import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { LinkedText } from '@/components/ui/linked-text';
import { Text } from '@/components/ui/text';
import { nomsDesContacts } from '@/lib/contacts-fiche';
import { useAnnuaire, useColleguesDeLaFiche } from '@/lib/data';
import { useContentMenu } from '@/lib/moderation';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { externalUrl, instagramUrl, mapsUrl, openLink, phoneUrl } from '@/lib/links';
import type { Commercant } from '@/lib/types';
import { useTheme } from '@/theme';

export default function CommercantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const annuaire = useAnnuaire();
  const { colors } = useTheme();
  const { categories } = useTenantConfig();
  const { profile } = useMember();
  const openMenu = useContentMenu();
  const m = annuaire.data?.find((item) => item.id === Number(id));
  const collegues = useColleguesDeLaFiche(m?.id);

  if (annuaire.isPending) return <LoadingState />;
  if (!m) {
    return annuaire.isError ? (
      <ErrorState onRetry={annuaire.refetch} />
    ) : (
      <EmptyState title="Fiche introuvable" message="Elle a peut-être été supprimée." />
    );
  }

  const contact = nomsDesContacts({ prenom: m.prenom_contact, nom: m.nom_contact }, collegues.data ?? []);
  const name = m.nom_entreprise || contact;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {m.photo_url ? (
        <Image
          source={{ uri: m.photo_url }}
          style={[styles.photo, { backgroundColor: colors.fill }]}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`Photo de ${name}`}
        />
      ) : (
        <Avatar name={name} size={80} />
      )}
      <View style={styles.head}>
        {categories.annuaire.length > 0 && <Badge label={m.categorie} />}
        <Text variant="title" selectable>
          {name}
        </Text>
        {!!contact && !!m.nom_entreprise && <Text tone="secondary">{contact}</Text>}
      </View>
      {!!m.description && <LinkedText>{m.description}</LinkedText>}
      <CoordonneesDeLaFiche fiche={m} />
      {!!m.user_id && m.user_id !== profile.id && (
        <ListSection>
          <ListRow
            icon="flag"
            title="Signaler cette fiche"
            onPress={() => openMenu({ kind: 'annuaire', targetId: m.id, authorId: m.user_id, authorName: name })}
          />
        </ListSection>
      )}
      {m.user_id === profile.id && (
        <Button title="Modifier ma fiche" icon="camera" variant="secondary" onPress={() => router.push('/plus/ma-fiche')} />
      )}
    </ScrollView>
  );
}

/** Adresse, téléphone, e-mail et réseaux de la fiche, chacun ouvrable d'un geste. */
function CoordonneesDeLaFiche({ fiche }: { fiche: Commercant }) {
  if (!(fiche.adresse || fiche.telephone || fiche.email || fiche.linkedin || fiche.instagram)) return null;
  return (
    <ListSection>
      {fiche.adresse && (
        <ListRow
          icon="location"
          title={fiche.adresse}
          subtitle="Itinéraire"
          onPress={() => openLink(mapsUrl(fiche.adresse!), { inApp: false })}
        />
      )}
      {fiche.telephone && (
        <ListRow
          icon="phone"
          title={fiche.telephone}
          subtitle="Appeler"
          onPress={() => openLink(phoneUrl(fiche.telephone!), { inApp: false })}
        />
      )}
      {fiche.email && (
        <ListRow icon="mail" title={fiche.email} onPress={() => openLink(`mailto:${fiche.email}`, { inApp: false })} />
      )}
      {fiche.linkedin && (
        <ListRow
          icon="briefcase"
          title="LinkedIn"
          onPress={() => openLink(externalUrl(fiche.linkedin!), { inApp: false })}
        />
      )}
      {fiche.instagram && (
        <ListRow
          icon="camera"
          title={fiche.instagram}
          subtitle="Instagram"
          onPress={() => openLink(instagramUrl(fiche.instagram!), { inApp: false })}
        />
      )}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  head: { gap: 6 },
});
