import { useCallback, useEffect, useState } from 'react';

import { changerLeBesoin, type Horaires, type Pole } from '../creneaux';
import { supabase, toast } from '../lib';

// Le planning des présences d'une action, côté bureau (supabase/creneaux.sql) : les horaires
// communs à tous les pôles, les pôles, et qui est inscrit où. Chaque geste s'enregistre aussitôt,
// comme les tâches de la fiche ; la base refuse elle-même un créneau complet.

export type Inscrit = { id: number; pole_id: number; debut: string; membre: string | null; nom: string; a_compte: boolean; a_reprendre?: boolean };

type LigneAction = {
  titre: string; emoji: string | null; date_action: string;
  ouvert_aux_membres: boolean; creneau_debut: string | null; creneau_fin: string | null; creneau_duree_minutes: number | null;
};

const versHoraires = (ligne: LigneAction): Horaires | null =>
  ligne.creneau_debut && ligne.creneau_fin && ligne.creneau_duree_minutes
    ? { debut: ligne.creneau_debut.slice(0, 5), fin: ligne.creneau_fin.slice(0, 5), dureeMinutes: ligne.creneau_duree_minutes }
    : null;

/** Lance une écriture ; en cas de refus, affiche le message de la base (« Ce créneau est complet. »). */
async function ecrire(requete: PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
  const { error } = await requete;
  if (error) toast(error.message, 'error');
  return !error;
}

export function usePlanning(actionId: number) {
  const [horaires, setHoraires] = useState<Horaires | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [inscrits, setInscrits] = useState<Inscrit[]>([]);
  const [estCharge, setEstCharge] = useState(false);
  const [action, setAction] = useState<{ titre: string; emoji: string | null; date: string } | null>(null);

  const charger = useCallback(async () => {
    const [ligne, lesPoles, lesInscrits] = await Promise.all([
      supabase.from('actions').select('titre, emoji, date_action, ouvert_aux_membres, creneau_debut, creneau_fin, creneau_duree_minutes').eq('id', actionId).single(),
      supabase.from('poles').select('id, nom, personnes, besoins_par_creneau, ordre').eq('action_id', actionId).order('ordre').order('id'),
      supabase.rpc('inscrits_de_l_action', { p_action: actionId }),
    ]);
    const erreur = ligne.error ?? lesPoles.error ?? lesInscrits.error;
    if (erreur) toast(erreur.message, 'error');
    if (ligne.data) {
      const donnees = ligne.data as LigneAction;
      setHoraires(versHoraires(donnees));
      setOuvert(donnees.ouvert_aux_membres);
      setAction({ titre: donnees.titre, emoji: donnees.emoji, date: donnees.date_action });
    }
    setPoles((lesPoles.data as Pole[] | null) ?? []);
    setInscrits((lesInscrits.data as Inscrit[] | null) ?? []);
    setEstCharge(true);
  }, [actionId]);

  useEffect(() => { charger(); }, [charger]);

  /** Écrit, puis relit tout : les places affichées restent celles de la base. */
  const ecrireEtRecharger = async (requete: PromiseLike<{ error: { message: string } | null }>) => {
    if (await ecrire(requete)) await charger();
  };
  const surLAction = (changement: Partial<LigneAction>) => supabase.from('actions').update(changement).eq('id', actionId);

  return {
    action, horaires, ouvert, poles, inscrits, estCharge, recharger: charger,
    enregistrerHoraires: (h: Horaires) => ecrireEtRecharger(surLAction({
      creneau_debut: h.debut, creneau_fin: h.fin, creneau_duree_minutes: h.dureeMinutes,
    })),
    basculerOuverture: (valeur: boolean) => ecrireEtRecharger(surLAction({ ouvert_aux_membres: valeur })),
    ajouterPole: (nom: string, personnes: number) => ecrireEtRecharger(supabase.from('poles').insert({
      action_id: actionId, nom: nom.trim(), personnes, ordre: poles.length,
    })),
    modifierPole: (pole: Pole, changement: Partial<Pick<Pole, 'nom' | 'personnes'>>) =>
      ecrireEtRecharger(supabase.from('poles').update(changement).eq('id', pole.id)),
    supprimerPole: (pole: Pole) => ecrireEtRecharger(supabase.from('poles').delete().eq('id', pole.id)),
    changerBesoin: (pole: Pole, heure: string, besoin: number) =>
      ecrireEtRecharger(supabase.from('poles').update({ besoins_par_creneau: changerLeBesoin(pole, heure, besoin) }).eq('id', pole.id)),
    ajouterUnNom: (pole: Pole, heure: string, nom: string) =>
      ecrireEtRecharger(supabase.from('inscriptions_creneaux').insert({ pole_id: pole.id, debut: heure, nom_libre: nom.trim() })),
    retirerInscrit: (inscrit: Inscrit) => ecrireEtRecharger(supabase.from('inscriptions_creneaux').delete().eq('id', inscrit.id)),
    /** Le membre du bureau connecté prend une place ; la base refuse si le créneau est complet. */
    jeViens: (pole: Pole, heure: string, moi: string) =>
      ecrireEtRecharger(supabase.from('inscriptions_creneaux').insert({ pole_id: pole.id, debut: heure, membre: moi })),
    /** Comme « Je ne peux plus venir » dans l'app : la place se libère et le référent est prévenu. */
    jeMeRetire: (inscrit: Inscrit) => ecrireEtRecharger(supabase.from('inscriptions_creneaux')
      .update({ annulee_le: new Date().toISOString(), annulation_notifiee: false }).eq('id', inscrit.id)),
  };
}

export type PlanningEtat = ReturnType<typeof usePlanning>;
