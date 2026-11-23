import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChampsDeProposition, Proposition } from '@/lib/evenements-proposes-regles';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Les propositions d'événements (supabase/propositions_evenements.sql). Côté membre : les siennes
// pour suivre la réponse du bureau, et l'envoi d'une nouvelle. Côté bureau (Pilotage) : celles qui
// attendent une réponse, puis accepter ou ne pas retenir ; notify-taches prévient l'auteur.

const CLE = ['evenements-proposes'];
const COLONNES = 'id, auteur, auteur_nom, type, titre, description, periode, date, heure, lieu, repetition, nb_mois, statut, mot_du_bureau, devenue, evenement_id, idee_id, created_at';

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

/** Les champs tels que la base les attend : une proposition à organiser n'a ni date ni lieu, un événement pas de période. */
function argumentsDeLaProposition(champs: ChampsDeProposition) {
  const estPersonnel = champs.type === 'personnel';
  return {
    p_titre: champs.titre.trim(),
    p_description: champs.description.trim(),
    p_periode: estPersonnel ? null : champs.periode.trim() || null,
    p_date: estPersonnel ? champs.date : null,
    p_heure: estPersonnel ? champs.heure.trim() || null : null,
    p_lieu: estPersonnel ? champs.lieu.trim() : null,
    p_repetition: estPersonnel ? champs.repetition : 'aucune',
    p_nb_mois: estPersonnel && champs.repetition !== 'aucune' ? champs.nbMois : null,
  };
}

/** Envoie la proposition ; une proposition à organiser apparaît aussi dans la boîte à idées. */
export function useProposerUnEvenement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (champs: ChampsDeProposition) => {
      const { error } = await supabase.rpc('proposer_evenement', { p_type: champs.type, ...argumentsDeLaProposition(champs) });
      if (error) throw new Error(error.message);
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: CLE }), client.invalidateQueries({ queryKey: ['idees'] })]),
  });
}

const CLE_A_VALIDER = ['propositions-a-valider'];
export type PropositionAValider = Proposition & { soutiens: number };
export type Devenir = 'evenement' | 'action';

/** Pour le bureau : les propositions en attente, les plus anciennes d'abord, avec les soutiens de l'idée liée. */
export function usePropositionsAValider() {
  return useQuery({
    queryKey: CLE_A_VALIDER,
    queryFn: async (): Promise<PropositionAValider[]> => {
      const { data, error } = await supabase.from('propositions_evenements').select(COLONNES).eq('statut', 'en_attente').order('created_at');
      if (error) throw error;
      const propositions = (data ?? []) as Proposition[];
      const idees = propositions.map((p) => p.idee_id).filter(Boolean) as number[];
      const { data: soutiens } = idees.length ? await supabase.from('idees').select('id, idees_likes(count)').in('id', idees) : { data: [] };
      const compte = (id: number | null) => (soutiens as { id: number; idees_likes: { count: number }[] }[] | null)?.find((i) => i.id === id)?.idees_likes[0]?.count ?? 0;
      return propositions.map((p) => ({ ...p, soutiens: compte(p.idee_id) }));
    },
  });
}

type Reponse = { proposition: Proposition } & ({ accepter: true; devenir: Devenir; date: string | null } | { accepter: false; mot: string });

/** Pour le bureau : accepter (Agenda ou Pilotage) ou ne pas retenir ; le Pilotage et l'Agenda se relisent. */
export function useRepondreALaProposition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (r: Reponse) => {
      const { error } = r.accepter
        ? await supabase.rpc('accepter_proposition', { p_proposition: r.proposition.id, p_devenir: r.devenir, p_date: r.date })
        : await supabase.rpc('refuser_proposition', { p_proposition: r.proposition.id, p_mot: r.mot.trim() || null });
      if (error) throw new Error(error.message);
    },
    onSettled: () => Promise.all(['propositions-a-valider', 'bureau', 'evenements'].map((cle) => client.invalidateQueries({ queryKey: [cle] }))),
  });
}

/** Ce que l'auteur peut encore faire de sa proposition : la corriger ou la retirer (en attente), retirer les séances à venir (publiée). */
export function useMaProposition() {
  const client = useQueryClient();
  const relire = () => Promise.all([CLE, ['idees'], ['evenements'], CLE_A_VALIDER].map((cle) => client.invalidateQueries({ queryKey: cle })));
  const appeler = async (fonction: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fonction, args);
    if (error) throw new Error(error.message);
    return data as unknown;
  };
  const modifier = useMutation({
    mutationFn: async ({ id, champs }: { id: number; champs: ChampsDeProposition }) => { await appeler('modifier_proposition', { p_proposition: id, ...argumentsDeLaProposition(champs) }); },
    onSettled: relire,
  });
  const retirer = useMutation({ mutationFn: async (id: number) => { await appeler('retirer_proposition', { p_proposition: id }); }, onSettled: relire });
  /** Rend le nombre de séances retirées de l'Agenda. */
  const retirerLesSeances = useMutation({ mutationFn: async (id: number) => Number(await appeler('retirer_seances_a_venir', { p_proposition: id })), onSettled: relire });
  return { modifier, retirer, retirerLesSeances };
}
