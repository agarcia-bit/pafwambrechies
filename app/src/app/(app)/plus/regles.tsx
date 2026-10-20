import { ScrollView, StyleSheet } from 'react-native';

import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { SUPPORT_EMAIL } from '@/lib/config';
import { openLink } from '@/lib/links';

// Rules of the community: shown to the members, and the basis of the moderation.
export default function ReglesScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text>
        Cet espace est celui de votre association : chacun doit s’y sentir bien. Les commentaires, idées, offres et
        fiches publiés par les membres sont soumis à ces règles.
      </Text>
      <Text variant="headline">Ce qui n’est pas accepté</Text>
      <Text>
        • les propos offensants, injurieux, haineux, discriminatoires ou harcelants{'\n'}• les contenus violents, sexuels
        ou illégaux{'\n'}• le spam et la publicité qui ne concerne pas l’association{'\n'}• l’usurpation d’identité et la
        diffusion d’informations privées sur autrui
      </Text>
      <Text variant="headline">Signaler et bloquer</Text>
      <Text>
        Sur un commentaire, une idée, une offre ou une fiche écrits par un autre membre, appuyez sur le drapeau pour le
        signaler ou bloquer son auteur. Le bureau de l’association examine chaque signalement et retire les contenus qui
        ne respectent pas les règles. Un membre bloqué n’apparaît plus pour vous : vous pouvez le débloquer à tout moment
        dans Mon compte.
      </Text>
      <Text variant="headline">Sanctions</Text>
      <Text>
        Un contenu contraire aux règles est supprimé. Les récidives peuvent entraîner la suppression du compte du membre
        par l’association.
      </Text>
      {!!SUPPORT_EMAIL && (
        <ListSection title="Une question ?">
          <ListRow icon="mail" title={SUPPORT_EMAIL} onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`, { inApp: false })} />
        </ListSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
});
