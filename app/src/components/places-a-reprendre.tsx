import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { choisirParmi, showMessage } from '@/lib/confirm';
import { libelleDeTranche } from '@/lib/creneaux';
import { formatDayLong } from '@/lib/format';
import type { Billet, PlanningOuvert } from '@/lib/mes-creneaux';
import { messageDeRemplacement, placesAReprendre, useRemplacement } from '@/lib/remplacement-creneau';

/**
 * Les gestes d'un billet quand on ne peut plus venir : chercher un remplaçant (mis en avant) ou
 * libérer sa place tout de suite ; pendant la recherche, partager le lien ou revenir.
 */
export function useGestesDuBillet(planning: PlanningOuvert, libererTout: (billet: Billet) => void) {
  const { chercher, revenir, reprendre } = useRemplacement();
  const jour = formatDayLong(planning.date).toLowerCase();
  const partager = (billet: Billet) =>
    Share.share({ message: messageDeRemplacement(planning, jour, billet.nomDuPole, billet.heure) }).catch(() => showMessage('Partage impossible'));

  async function nePlusVenir(billet: Billet) {
    const reponse = await choisirParmi({
      title: 'Vous ne pouvez plus venir ?',
      message: `${billet.nomDuPole}, ${libelleDeTranche(billet.heure, planning.duree_minutes)}. Chercher un remplaçant garde la place à votre nom jusqu’à ce que quelqu’un la reprenne.`,
      choix: [
        { label: 'Chercher un remplaçant', valeur: 'remplacant' },
        { label: 'Libérer ma place tout de suite', valeur: 'liberer', destructive: true },
      ],
    });
    if (reponse === 'liberer') libererTout(billet);
    if (reponse === 'remplacant') chercher.mutate(billet.inscription, { onSuccess: () => partager(billet) });
  }

  return {
    nePlusVenir,
    partager,
    revenir: (billet: Billet) => revenir.mutate(billet.inscription),
    reprendre,
    enCours: chercher.isPending || revenir.isPending || reprendre.isPending,
    erreur: chercher.error ?? revenir.error ?? reprendre.error,
  };
}

/** Les places que d'autres membres cherchent à faire reprendre : « Je la prends ». Rien s'il n'y en a pas. */
export function PlacesAReprendre({ planning, enCours, onReprendre }: { planning: PlanningOuvert; enCours: boolean; onReprendre: (inscription: number) => void }) {
  const places = placesAReprendre(planning);
  if (!places.length) return null;
  return (
    <View style={styles.bloc}>
      <Text variant="headline">À reprendre</Text>
      <Text variant="footnote" tone="secondary">Ces bénévoles ne peuvent plus venir et cherchent quelqu’un pour les remplacer.</Text>
      {places.map((p) => (
        <Card key={p.inscription} style={styles.carte}>
          <Text variant="subhead" style={styles.titre}>{p.nomDuPole} · {libelleDeTranche(p.heure, planning.duree_minutes)}</Text>
          <Button title="Je la prends" compact loading={enCours} onPress={() => onReprendre(p.inscription)} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  carte: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  titre: { flex: 1, fontWeight: '600' },
});
