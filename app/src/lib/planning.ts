import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminErrorMessage } from '@/lib/admin';
import { changerLeBesoin, type Horaires, type Pole } from '@/lib/creneaux';
import type { Presence } from '@/lib/pointage';
import { supabase } from '@/lib/supabase';

// Le planning des présences d'une action, côté bureau (supabase/creneaux.sql) : les horaires
// communs à tous les pôles, les pôles, et qui est inscrit où. La base refuse elle-même un créneau
// complet ou une heure qui n'existe pas : son message s'affiche tel quel.

export type Inscrit = {
  id: number; pole_id: number; debut: string; membre: string | null; nom: string; a_compte: boolean; a_reprendre?: boolean;
  /** Le pointage du jour J (supabase/presences_benevoles.sql) ; absent tant que personne n'a pointé. */
  presence?: Presence | null;
};
export type Planning = { titre: string; date: string; horaires: Horaires | null; ouvert: boolean; poles: Pole[]; inscrits: Inscrit[] };

type LigneAction = {
  titre: string; date_action: string;
  ouvert_aux_membres: boolean; creneau_debut: string | null; creneau_fin: string | null; creneau_duree_minutes: number | null;
};

const versHoraires = (ligne: LigneAction): Horaires | null =>
  ligne.creneau_debut && ligne.creneau_fin && ligne.creneau_duree_minutes
    ? { debut: ligne.creneau_debut.slice(0, 5), fin: ligne.creneau_fin.slice(0, 5), dureeMinutes: ligne.creneau_duree_minutes }
    : null;

const clePlanning = (actionId: number) => ['planning', actionId];

export function usePlanning(actionId: number) {
  return useQuery({
    queryKey: clePlanning(actionId),
    queryFn: async (): Promise<Planning> => {
      const [action, poles, inscrits] = await Promise.all([
        supabase.from('actions').select('titre, date_action, ouvert_aux_membres, creneau_debut, creneau_fin, creneau_duree_minutes').eq('id', actionId).single(),
        supabase.from('poles').select('id, nom, personnes, besoins_par_creneau, ordre').eq('action_id', actionId).order('ordre').order('id'),
        supabase.rpc('inscrits_de_l_action', { p_action: actionId }),
      ]);
      const erreur = action.error ?? poles.error ?? inscrits.error;
      if (erreur) throw erreur;
      const ligne = action.data as LigneAction;
      return { titre: ligne.titre, date: ligne.date_action, horaires: versHoraires(ligne), ouvert: ligne.ouvert_aux_membres, poles: poles.data as Pole[], inscrits: inscrits.data as Inscrit[] };
    },
  });
}

/** Les inscrits d'une case de la grille. */
export const inscritsDuCreneau = (planning: Planning, poleId: number, heure: string) =>
  planning.inscrits.filter((i) => i.pole_id === poleId && i.debut === heure);

type Modification =
  | { type: 'horaires'; horaires: Horaires }
  | { type: 'ouverture'; ouvert: boolean }
  | { type: 'ajouter-pole'; nom: string; personnes: number; ordre: number }
  | { type: 'modifier-pole'; pole: Pole; changement: Partial<Pick<Pole, 'nom' | 'personnes'>> }
  | { type: 'supprimer-pole'; pole: Pole }
  | { type: 'besoin'; pole: Pole; heure: string; besoin: number }
  | { type: 'ajouter-nom'; pole: Pole; heure: string; nom: string }
  | { type: 'retirer'; inscrit: Inscrit }
  | { type: 'je-viens'; pole: Pole; heure: string; moi: string }
  | { type: 'je-me-retire'; inscrit: Inscrit }
  | { type: 'pointer'; inscrit: Inscrit; presence: Presence | null };

/** La requête qui correspond à chaque geste du bureau sur le planning. */
function requeteDe(actionId: number, m: Modification) {
  switch (m.type) {
    case 'horaires':
      return supabase.from('actions').update({
        creneau_debut: m.horaires.debut, creneau_fin: m.horaires.fin, creneau_duree_minutes: m.horaires.dureeMinutes,
      }).eq('id', actionId);
    case 'ouverture': return supabase.from('actions').update({ ouvert_aux_membres: m.ouvert }).eq('id', actionId);
    case 'ajouter-pole': return supabase.from('poles').insert({ action_id: actionId, nom: m.nom.trim(), personnes: m.personnes, ordre: m.ordre });
    case 'modifier-pole': return supabase.from('poles').update(m.changement).eq('id', m.pole.id);
    case 'supprimer-pole': return supabase.from('poles').delete().eq('id', m.pole.id);
    case 'besoin': return supabase.from('poles').update({ besoins_par_creneau: changerLeBesoin(m.pole, m.heure, m.besoin) }).eq('id', m.pole.id);
    case 'ajouter-nom': return supabase.from('inscriptions_creneaux').insert({ pole_id: m.pole.id, debut: m.heure, nom_libre: m.nom.trim() });
    case 'retirer': return supabase.from('inscriptions_creneaux').delete().eq('id', m.inscrit.id);
    case 'je-viens': return supabase.from('inscriptions_creneaux').insert({ pole_id: m.pole.id, debut: m.heure, membre: m.moi });
    // Comme « Je ne peux plus venir » côté adhérent : la place se libère et le référent est prévenu.
    case 'je-me-retire': return supabase.from('inscriptions_creneaux')
      .update({ annulee_le: new Date().toISOString(), annulation_notifiee: false }).eq('id', m.inscrit.id);
    case 'pointer': return supabase.from('inscriptions_creneaux')
      .update({ presence: m.presence, pointe_le: m.presence ? new Date().toISOString() : null }).eq('id', m.inscrit.id);
  }
}

/** Un seul point d'écriture : chaque geste s'enregistre, puis le planning se relit depuis la base. */
export function useModifierLePlanning(actionId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (modification: Modification) => {
      const { error } = await requeteDe(actionId, modification);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: clePlanning(actionId) }),
  });
}

/** Le message à afficher : celui de la base quand elle refuse (« Ce créneau est complet. »), sinon le message habituel. */
export function messageDuPlanning(erreur: unknown): string {
  const { code, message } = (erreur ?? {}) as { code?: string; message?: string };
  return code === 'P0001' && message ? message : adminErrorMessage(erreur);
}
