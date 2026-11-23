import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { estDejaPrisALHeure, libelleDeTranche, resumeDesTrous, type Trou } from '@/lib/creneaux';
import type { Planning, useModifierLePlanning } from '@/lib/planning';
import { useTheme } from '@/theme';
import { tint } from '@/theme/colors';

type Modifier = ReturnType<typeof useModifierLePlanning>['mutate'];

/**
 * Le haut du planning, comme sur la page de l'espace bureau : une phrase qui dit ce qui manque,
 * le statut, et le bouton pour ouvrir le planning aux membres (ou le réserver au bureau).
 */
export function EnteteDuPlanning({ trous, ouvert, modifier, enCours }: { trous: Trou[]; ouvert: boolean; modifier: Modifier; enCours: boolean }) {
  const { colors, scheme } = useTheme();
  const { manque, poleLePlusEnManque } = resumeDesTrous(trous);
  // L'ambre du système est trop clair pour du texte sur fond clair : sa version foncée reste lisible.
  const ambre = tint(scheme, colors.warning).color;
  return (
    <View style={styles.entete}>
      <Text variant="title" accessibilityRole="header">
        {manque ? (
          <>
            Il manque <Text variant="title" style={{ color: ambre }}>{manque} personne{manque > 1 ? 's' : ''}</Text>
            {poleLePlusEnManque ? `, surtout au pôle ${poleLePlusEnManque}` : ''}.
          </>
        ) : 'Tout est rempli. Merci à tous !'}
      </Text>
      <View style={styles.statut}>
        <Badge label={ouvert ? 'Ouvert aux membres' : 'Réservé au bureau'} hue={ouvert ? colors.success : undefined} />
      </View>
      {ouvert
        ? <Button title="Réserver au bureau" variant="secondary" loading={enCours} onPress={() => modifier({ type: 'ouverture', ouvert: false })} />
        : <Button title="Ouvrir aux membres" loading={enCours} onPress={() => modifier({ type: 'ouverture', ouvert: true })} />}
    </View>
  );
}

type PropsDeListe = { actionId: number; trous: Trou[]; planning: Planning; moi: string; modifier: Modifier };

/** Ce qui manque : une ligne par créneau à compléter, la plus urgente en premier, avec « Je viens ». */
export function ListeDesTrous({ actionId, trous, planning, moi, modifier }: PropsDeListe) {
  if (!trous.length) return <Text tone="secondary" style={styles.vide}>Il ne manque personne.</Text>;
  const duree = planning.horaires?.dureeMinutes ?? 60;
  return (
    <ListSection>
      {trous.map((trou) => {
        const dejaPris = estDejaPrisALHeure(planning.inscrits, moi, trou.heure);
        return (
          <ListRow
            key={`${trou.pole.id}-${trou.heure}`}
            title={`${trou.pole.nom} · ${libelleDeTranche(trou.heure, duree)}`}
            subtitle={`${trou.manque} place${trou.manque > 1 ? 's' : ''} libre${trou.manque > 1 ? 's' : ''} · ${trou.presents.length ? `avec ${trou.presents.join(', ')}` : 'personne pour l’instant'}`}
            accessibilityHint="Ouvre le créneau pour ajouter quelqu’un ou changer le nombre de places"
            onPress={() => router.push({ pathname: '/plus/bureau/creneau', params: { action: String(actionId), pole: String(trou.pole.id), heure: trou.heure } })}
            right={
              dejaPris
                ? <Badge label={trou.estMoi ? 'Vous y êtes' : 'Vous êtes ailleurs'} />
                : <Button compact title="Je viens" variant="secondary" onPress={() => modifier({ type: 'je-viens', pole: trou.pole, heure: trou.heure, moi })} />
            }
          />
        );
      })}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  entete: { gap: 12 },
  statut: { flexDirection: 'row' },
  vide: { textAlign: 'center', paddingVertical: 16 },
});
