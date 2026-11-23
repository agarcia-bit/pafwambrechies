import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DateTile } from '@/components/actu-visual';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { libelleDeTranche } from '@/lib/creneaux';
import { plural } from '@/lib/format';
import { resumeDuPlanning, usePlanningsOuverts, type PlanningOuvert } from '@/lib/mes-creneaux';
import { useMesEchanges } from '@/lib/echanges-creneaux';
import { placesAReprendre } from '@/lib/remplacement-creneau';
import { useTheme } from '@/theme';

/**
 * En tête de l'Agenda : les actions où le bureau cherche du monde. Rien quand aucun planning n'est
 * ouvert, pour ne pas encombrer l'écran le reste de l'année.
 */
export function BesoinDeBras() {
  const plannings = usePlanningsOuverts();
  const avecDesPoles = (plannings.data ?? []).filter((p) => p.poles.length > 0);
  if (!avecDesPoles.length) return null;
  return (
    <View style={styles.bloc}>
      <Text variant="headline" style={styles.titre}>On a besoin de vous</Text>
      {avecDesPoles.map((planning) => <CarteDePlanning key={planning.id} planning={planning} />)}
    </View>
  );
}

function CarteDePlanning({ planning }: { planning: PlanningOuvert }) {
  const { colors } = useTheme();
  const { libres, mesCreneaux } = resumeDuPlanning(planning);
  const aReprendre = placesAReprendre(planning).length;
  const echangesRecus = (useMesEchanges().data ?? []).filter((e) => e.action === planning.id && e.sens === 'recu').length;
  // Ce qui attend une réponse passe avant le reste : un échange proposé, puis une place à reprendre.
  const resume = echangesRecus ? `${plural(echangesRecus, 'proposition d’échange', 'propositions d’échange')} pour vous`
    : aReprendre ? `${plural(aReprendre, 'place à reprendre', 'places à reprendre')} · Je la prends`
    : mesCreneaux.length ? `Vous : ${mesCreneaux.map((c) => `${c.pole}, ${libelleDeTranche(c.heure, planning.duree_minutes)}`).join(' · ')}`
    : libres ? `${plural(libres, 'place libre', 'places libres')} · Choisir un créneau` : 'Complet, merci à tous !';
  return (
    <PressableCard
      style={styles.carte}
      accessibilityLabel={`${planning.titre}. ${resume}`}
      onPress={() => router.push({ pathname: '/agenda/creneaux/[action]', params: { action: String(planning.id) } })}>
      <DateTile date={planning.date} large />
      <View style={styles.texte}>
        <Text variant="headline">{planning.emoji ? `${planning.emoji} ` : ''}{planning.titre}</Text>
        <Text variant="subhead" style={{ color: mesCreneaux.length ? colors.primary : colors.textSecondary, fontWeight: mesCreneaux.length ? '600' : '400' }}>
          {resume}
        </Text>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8, marginTop: 16 },
  titre: { marginHorizontal: 20 },
  carte: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  texte: { flex: 1, gap: 2 },
});
