import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useAnnuaire } from '@/lib/data';
import { fullName } from '@/lib/format';
import { externalUrl, instagramUrl, mapsUrl, openLink, phoneUrl } from '@/lib/links';
import { useTheme } from '@/theme';

export default function CommercantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const annuaire = useAnnuaire();
  const { colors } = useTheme();
  const m = annuaire.data?.find((item) => item.id === Number(id));

  if (annuaire.isPending) return <LoadingState />;
  if (!m) {
    return annuaire.isError ? (
      <ErrorState onRetry={annuaire.refetch} />
    ) : (
      <EmptyState title="Fiche introuvable" message="Elle a peut-être été supprimée." />
    );
  }

  const contact = fullName(m.prenom_contact, m.nom_contact);
  const name = m.nom_entreprise || contact;
  const hasContacts = !!(m.adresse || m.telephone || m.email || m.linkedin || m.instagram);

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
        <Badge label={m.categorie} />
        <Text variant="title" selectable>
          {name}
        </Text>
        {!!contact && !!m.nom_entreprise && <Text tone="secondary">{contact}</Text>}
      </View>
      {!!m.description && <Text selectable>{m.description}</Text>}
      {hasContacts && (
        <ListSection>
          {m.adresse && (
            <ListRow
              icon="location"
              title={m.adresse}
              subtitle="Itinéraire"
              onPress={() => openLink(mapsUrl(m.adresse!), { inApp: false })}
            />
          )}
          {m.telephone && (
            <ListRow
              icon="phone"
              title={m.telephone}
              subtitle="Appeler"
              onPress={() => openLink(phoneUrl(m.telephone!), { inApp: false })}
            />
          )}
          {m.email && (
            <ListRow icon="mail" title={m.email} onPress={() => openLink(`mailto:${m.email}`, { inApp: false })} />
          )}
          {m.linkedin && (
            <ListRow
              icon="briefcase"
              title="LinkedIn"
              onPress={() => openLink(externalUrl(m.linkedin!), { inApp: false })}
            />
          )}
          {m.instagram && (
            <ListRow
              icon="camera"
              title={m.instagram}
              subtitle="Instagram"
              onPress={() => openLink(instagramUrl(m.instagram!), { inApp: false })}
            />
          )}
        </ListSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  head: { gap: 6 },
});
