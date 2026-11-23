import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePropositionsAValider, type PropositionAValider } from '@/lib/evenements-proposes';
import { LIBELLE_DU_TYPE } from '@/lib/evenements-proposes-regles';
import { useTheme } from '@/theme';

/**
 * En haut du Pilotage de l'app : les événements proposés par les membres qui attendent une réponse
 * du bureau, comme dans l'espace bureau. Rien quand il n'y en a pas.
 */
export function PropositionsAValider() {
  const propositions = usePropositionsAValider();
  const liste = propositions.data ?? [];
  if (!liste.length) return null;
  return (
    <Card style={styles.carte} accessibilityLabel="Propositions des membres">
      <Text variant="headline">{liste.length} proposition{liste.length > 1 ? 's' : ''} des membres</Text>
      {liste.map((p) => <LigneAValider key={p.id} proposition={p} />)}
    </Card>
  );
}

function LigneAValider({ proposition: p }: { proposition: PropositionAValider }) {
  const { colors } = useTheme();
  const precision = [
    LIBELLE_DU_TYPE[p.type],
    p.repetition === 'mois' ? 'chaque mois' : p.repetition === 'semaine' ? 'chaque semaine' : null,
    p.type === 'a_organiser' ? `${p.soutiens} soutien${p.soutiens > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <PressableCard
      style={[styles.ligne, { backgroundColor: colors.fill }]}
      accessibilityLabel={`${p.titre}, proposé par ${p.auteur_nom ?? 'un membre'}. Répondre`}
      onPress={() => router.push({ pathname: '/plus/bureau/proposition', params: { id: String(p.id) } })}>
      <View style={styles.texte}>
        <Text variant="subhead" style={styles.titre} numberOfLines={2}>{p.titre}</Text>
        <Text variant="footnote" tone="secondary">{p.auteur_nom ?? 'Un membre'} · {precision}</Text>
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  carte: { marginHorizontal: 16, padding: 16, gap: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, minHeight: 44 },
  texte: { flex: 1, gap: 2 },
  titre: { fontWeight: '600' },
});
