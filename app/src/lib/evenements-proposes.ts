import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChampsDeProposition, Proposition } from '@/lib/evenements-proposes-regles';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Les propositions d'événements du membre connecté (supabase/propositions_evenements.sql) : les
// siennes pour suivre la réponse du bureau, et l'envoi d'une nouvelle proposition.

const CLE = ['evenements-proposes'];
const COLONNES = 'id, auteur, type, titre, description, periode, date, heure, lieu, repetition, nb_mois, statut, mot_du_bureau, devenue, evenement_id, idee_id, created_at';

/** Ses propositions récentes : toutes celles en attente, et les réponses du dernier mois. */
export function useMesEvenementsProposes() {
  const { profile } = useMember();
  return useQuery({
    queryKey: CLE,
    queryFn: async (): Promise<Proposition[]> => {
      const ilYAUnMois = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase.from('propositions_evenements').select(COLONNES)
        .eq('auteur', profile.id).or(`statut.eq.en_attente,decide_le.gte.${ilYAUnMois}`)
        .order('created_at', { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as Proposition[];
    },
  });
}

/** Envoie la proposition ; une proposition à organiser apparaît aussi dans la boîte à idées. */
export function useProposerUnEvenement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (champs: ChampsDeProposition) => {
      const estPersonnel = champs.type === 'personnel';
      const { error } = await supabase.rpc('proposer_evenement', {
        p_type: champs.type,
        p_titre: champs.titre.trim(),
        p_description: champs.description.trim(),
        p_periode: estPersonnel ? null : champs.periode.trim() || null,
        p_date: estPersonnel ? champs.date : null,
        p_heure: estPersonnel ? champs.heure.trim() || null : null,
        p_lieu: estPersonnel ? champs.lieu.trim() : null,
        p_repetition: estPersonnel ? champs.repetition : 'aucune',
        p_nb_mois: estPersonnel && champs.repetition !== 'aucune' ? champs.nbMois : null,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: CLE }), client.invalidateQueries({ queryKey: ['idees'] })]),
  });
}
