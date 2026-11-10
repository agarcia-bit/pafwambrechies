import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceField } from '@/components/form-fields';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import type { MaReponse } from '@/lib/participation';
import { formatJourCourt, joursDeLEvenement } from '@/lib/periode';
import type { Evenement } from '@/lib/types';

const TOUTE_LA_DUREE = 'toute';

export type JoursChoisis = Pick<MaReponse, 'jours' | 'precision'>;

/** Les jours cochés : vide veut dire toute la durée, et cocher tous les jours revient au même. */
function useJoursCoches(ev: Evenement, depart: string[] | null) {
  const tousLesJours = joursDeLEvenement(ev);
  const [jours, setJours] = useState<string[]>(depart ?? []);
  function basculer(option: string) {
    if (option === TOUTE_LA_DUREE) return setJours([]);
    const suivants = jours.includes(option) ? jours.filter((jour) => jour !== option) : [...jours, option];
    setJours(suivants.length === tousLesJours.length ? [] : suivants.sort());
  }
  const estCoche = (option: string) => (option === TOUTE_LA_DUREE ? !jours.length : jours.includes(option));
  return { options: [TOUTE_LA_DUREE, ...tousLesJours], jours, basculer, estCoche };
}

/**
 * Pour un événement sur plusieurs jours, l'adhérent qui vient dit quels jours (ou toute la durée)
 * et peut ajouter un mot pour le bureau.
 */
export function ChoixDesJours({
  event: ev,
  depart,
  enCours,
  onValider,
  onAnnuler,
}: {
  event: Evenement;
  depart?: JoursChoisis;
  enCours: boolean;
  onValider: (choix: JoursChoisis) => void;
  onAnnuler?: () => void;
}) {
  const { options, jours, basculer, estCoche } = useJoursCoches(ev, depart?.jours ?? null);
  const [precision, setPrecision] = useState(depart?.precision ?? '');

  return (
    <View style={styles.bloc}>
      <ChoiceField
        label="Quels jours venez-vous ?"
        options={options}
        value=""
        onChange={basculer}
        estChoisi={estCoche}
        format={(option) => (option === TOUTE_LA_DUREE ? 'Toute la durée' : formatJourCourt(option))}
      />
      <TextField
        label="Une précision ? (facultatif)"
        value={precision}
        onChangeText={setPrecision}
        placeholder="Ex. : j’arrive samedi vers 15 h"
        maxLength={300}
        multiline
      />
      <Button
        title="Valider ma présence"
        icon="checkCircle"
        loading={enCours}
        disabled={enCours}
        onPress={() => onValider({ jours: jours.length ? jours : null, precision: precision.trim() || null })}
      />
      {onAnnuler && <Button title="Annuler" variant="plain" disabled={enCours} onPress={onAnnuler} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 12 },
});
