import { useCallback, useEffect, useState } from 'react';

import type { Proposition } from '../evenements-proposes-regles';
import { supabase, toast } from '../lib';

// Les événements proposés par les membres et en attente d'une réponse (supabase/
// propositions_evenements.sql), pour l'encadré du Pilotage : les charger, puis accepter ou ne
// pas retenir. Le membre est prévenu de la réponse par notify-taches.

export type PropositionAvecSoutiens = Proposition & { soutiens: number };
export type Devenir = 'evenement' | 'action';

const COLONNES = 'id, auteur, auteur_nom, type, titre, description, periode, date, heure, lieu, repetition, nb_mois, statut, mot_du_bureau, devenue, evenement_id, idee_id, created_at';

/** Les propositions en attente, les plus anciennes d'abord, avec les soutiens de l'idée liée. */
async function chargerLesPropositions(): Promise<PropositionAvecSoutiens[]> {
  const { data, error } = await supabase.from('propositions_evenements').select(COLONNES).eq('statut', 'en_attente').order('created_at');
  if (error) throw error;
  const propositions = (data ?? []) as Proposition[];
  const idees = propositions.map((p) => p.idee_id).filter(Boolean) as number[];
  const { data: soutiens } = idees.length
    ? await supabase.from('idees').select('id, idees_likes(count)').in('id', idees)
    : { data: [] };
  const compte = (id: number | null) => (soutiens as { id: number; idees_likes: { count: number }[] }[] | null)?.find((i) => i.id === id)?.idees_likes[0]?.count ?? 0;
  return propositions.map((p) => ({ ...p, soutiens: compte(p.idee_id) }));
}

export function usePropositionsDesMembres() {
  const [propositions, setPropositions] = useState<PropositionAvecSoutiens[]>([]);
  const [enCours, setEnCours] = useState(false);

  const recharger = useCallback(() => {
    chargerLesPropositions().then(setPropositions).catch((e: Error) => toast(e.message, 'error'));
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  /** Appelle la base ; rend vrai si la réponse est enregistrée. */
  async function repondre(appel: PromiseLike<{ error: { message: string } | null }>, merci: string): Promise<boolean> {
    setEnCours(true);
    const { error } = await appel;
    setEnCours(false);
    if (error) { toast(error.message, 'error'); return false; }
    toast(merci);
    recharger();
    return true;
  }

  const accepter = (p: Proposition, devenir: Devenir, date: string | null) => repondre(
    supabase.rpc('accepter_proposition', { p_proposition: p.id, p_devenir: devenir, p_date: date }),
    p.type === 'personnel' || devenir === 'evenement' ? `« ${p.titre} » est publié dans l’Agenda` : `« ${p.titre} » est ajouté au Pilotage`,
  );
  const refuser = (p: Proposition, mot: string) => repondre(
    supabase.rpc('refuser_proposition', { p_proposition: p.id, p_mot: mot.trim() || null }),
    `${p.auteur_nom?.split(' ')[0] ?? 'Le membre'} sera prévenu de votre réponse`,
  );

  return { propositions, enCours, accepter, refuser, recharger };
}

export type PropositionsEtat = ReturnType<typeof usePropositionsDesMembres>;
