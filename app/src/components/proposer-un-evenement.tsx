import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useMesEvenementsProposes } from '@/lib/evenements-proposes';
import { libelleDuStatut, type Proposition, type StatutDeProposition } from '@/lib/evenements-proposes-regles';
import { useTheme } from '@/theme';

/** La couleur d'un statut : ambre = en attente, vert = acceptée, gris = pas retenue. */
export function useTeinteDuStatut() {
  const { colors } = useTheme();
  return (statut: StatutDeProposition) => ({ en_attente: colors.warning, acceptee: colors.success, refusee: undefined }[statut]);
}

/** Sur une idée qui est une proposition d'événement : où en est la réponse du bureau. */
export function BadgeDeProposition({ statut }: { statut?: StatutDeProposition | null }) {
  const teinte = useTeinteDuStatut();
  return statut ? <Badge label={libelleDuStatut(statut)} hue={teinte(statut)} /> : null;
}

/**
 * Dans l'Agenda : proposer un événement, puis suivre ses propositions (en attente, et les réponses
 * du dernier mois, avec le mot du bureau quand elle n'est pas retenue).
 */
export function CarteProposerUnEvenement() {
  const propositions = useMesEvenementsProposes();
  return (
    <Card style={styles.carte}>
      <Text variant="headline">Une idée de sortie, un événement à partager ?</Text>
      <Button title="Proposer un événement" icon="plus" variant="secondary" onPress={() => router.push('/agenda/proposer')} />
      {!!propositions.data?.length && (
        <View style={styles.liste} accessibilityLabel="Vos propositions">
          <Text variant="footnote" tone="secondary" style={styles.surtitre}>Vos propositions</Text>
          {propositions.data.map((p) => <LigneDeProposition key={p.id} proposition={p} />)}
        </View>
      )}
    </Card>
  );
}

function LigneDeProposition({ proposition: p }: { proposition: Proposition }) {
  return (
    <View style={styles.ligne}>
      <View style={styles.entete}>
        <Text variant="subhead" style={styles.titre} numberOfLines={1}>{p.titre}</Text>
        <BadgeDeProposition statut={p.statut} />
      </View>
      {p.statut === 'refusee' && !!p.mot_du_bureau && <Text variant="footnote" tone="secondary">Le mot du bureau : {p.mot_du_bureau}</Text>}
      {p.statut === 'acceptee' && p.devenue === 'action' && <Text variant="footnote" tone="secondary">Le bureau va l’organiser.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { marginHorizontal: 16, marginTop: 16, padding: 16, gap: 12 },
  liste: { gap: 10 },
  surtitre: { fontWeight: '600' },
  ligne: { gap: 2 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { flex: 1, fontWeight: '600' },
});
