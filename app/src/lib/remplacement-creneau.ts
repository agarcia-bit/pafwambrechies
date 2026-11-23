import { useMutation, useQueryClient } from '@tanstack/react-query';

import { libelleDeTranche } from './creneaux';
import { CLE_DES_PLANNINGS, type PlanningOuvert } from './mes-creneaux';
import { supabase } from './supabase';

// Le remplacement d'un créneau (supabase/creneaux.sql, section 9) : un membre qui ne peut plus venir
// cherche un remplaçant ; sa place reste à son nom, « à reprendre » pour les autres, jusqu'à ce que
// quelqu'un touche « Je la prends ». notify-taches le prévient alors qu'il est libéré.

export type PlaceAReprendre = { inscription: number; pole: number; nomDuPole: string; heure: string };

/** Les places à reprendre d'un planning, sauf aux heures où la personne est déjà prise. */
export function placesAReprendre(planning: PlanningOuvert): PlaceAReprendre[] {
  const mesHeures = new Set(planning.poles.flatMap((p) => p.mes_inscriptions.map((i) => i.debut)));
  return planning.poles
    .flatMap((pole) => (pole.a_reprendre ?? []).map((i) => ({ inscription: i.id, pole: pole.id, nomDuPole: pole.nom, heure: i.debut })))
    .filter((p) => !mesHeures.has(p.heure))
    .sort((a, b) => a.heure.localeCompare(b.heure));
}

/** Le message que la personne partage elle-même (SMS, WhatsApp…) pour trouver quelqu'un. */
export function messageDeRemplacement(planning: Pick<PlanningOuvert, 'id' | 'titre' | 'duree_minutes'>, jour: string, nomDuPole: string, heure: string): string {
  return `Je ne peux plus venir à « ${planning.titre} » ${jour} (${nomDuPole}, ${libelleDeTranche(heure, planning.duree_minutes)}). `
    + `Quelqu’un peut reprendre ma place ? Dans l’app Allianceo, onglet Agenda, ou ici : allianceo://agenda/creneaux/${planning.id}`;
}

/** Chercher un remplaçant, revenir (« Finalement, je viens »), ou reprendre la place d'un autre. */
export function useRemplacement() {
  const client = useQueryClient();
  const relire = () => client.invalidateQueries({ queryKey: CLE_DES_PLANNINGS });
  const appeler = (fonction: string) => async (inscription: number) => {
    const { error } = await supabase.rpc(fonction, { p_inscription: inscription });
    if (error) throw error;
  };
  const chercher = useMutation({ mutationFn: appeler('chercher_remplacant'), onSettled: relire });
  const revenir = useMutation({ mutationFn: appeler('annuler_recherche_de_remplacant'), onSettled: relire });
  const reprendre = useMutation({ mutationFn: appeler('reprendre_creneau'), onSettled: relire });
  return { chercher, revenir, reprendre };
}
