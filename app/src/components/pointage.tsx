import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { avecMentionDeReprise } from '@/lib/creneaux';
import type { Inscrit, Presence } from '@/lib/planning';
import { presenceApres, type TrancheAPointer } from '@/lib/pointage';
import { useTheme } from '@/theme';

// Plus foncées que les couleurs des réponses : le texte blanc doit rester lisible (4,5:1) en plein
// soleil, là où l'on pointe le jour J.
const VERT_VENU = '#1E7B34';
const ROUGE_ABSENT = '#C62828';

type PropsDeTranche = { tranche: TrancheAPointer; enCours: boolean; onPointer: (inscrit: Inscrit, presence: Presence | null) => void };

/** Une tranche horaire : chaque inscrit, son pôle, et « Venu » / « Absent » sous le pouce. */
export function TrancheDuPointage({ tranche, enCours, onPointer }: PropsDeTranche) {
  return (
    <ListSection title={tranche.libelle}>
      {tranche.inscrits.map(({ inscrit, nomDuPole }) => (
        <LigneDePointage key={inscrit.id} inscrit={inscrit} nomDuPole={nomDuPole} enCours={enCours}
          onChoisir={(choix) => onPointer(inscrit, presenceApres(inscrit.presence, choix))} />
      ))}
    </ListSection>
  );
}

function LigneDePointage({ inscrit, nomDuPole, enCours, onChoisir }: {
  inscrit: Inscrit; nomDuPole: string; enCours: boolean; onChoisir: (choix: Presence) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.ligne, { borderBottomColor: colors.separator }]}>
      <View style={styles.qui}>
        <Text variant="headline" numberOfLines={1}>{avecMentionDeReprise(inscrit.nom, inscrit.a_reprendre)}</Text>
        <Text variant="footnote" tone="secondary">{nomDuPole}</Text>
      </View>
      <View style={styles.boutons}>
        <Button compact title="Venu" icon="check" teinte={VERT_VENU} variant={inscrit.presence === 'venu' ? 'primary' : 'secondary'}
          disabled={enCours} onPress={() => onChoisir('venu')} />
        <Button compact title="Absent" teinte={ROUGE_ABSENT} variant={inscrit.presence === 'absent' ? 'primary' : 'secondary'}
          disabled={enCours} onPress={() => onChoisir('absent')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  qui: { gap: 2 },
  boutons: { flexDirection: 'row', gap: 8 },
});
