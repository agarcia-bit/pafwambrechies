import { useEffect, useRef, useState } from 'react';

import { supabase, today, toast, type Action, type Tache } from '../lib';
import {
  brouillonDepuisModele, decalerLesTaches, type BrouillonAction, type ModeleAction, type Priorite, type TacheBrouillon,
} from '../modeles-actions';

// L'état de la fiche d'une action du Pilotage.
//   * Une nouvelle action se prépare en entier (champs et tâches) avant d'exister : « Créer
//     l'action » enregistre tout d'un coup, et fermer avant demande confirmation.
//   * Une action existante s'enregistre toute seule peu après chaque modification : plus de
//     bouton « Enregistrer » à oublier.

const DELAI_ENREGISTREMENT_MS = 700;

export type ChampsAction = { emoji: string; titre: string; date_action: string; referent: string; statut: Action['statut']; budget: string };
export type NouvelleTache = { libelle: string; responsable: string; echeance: string; priorite: Priorite };

const valeursAEnregistrer = (f: ChampsAction) => ({
  emoji: f.emoji.trim() || null, titre: f.titre.trim(), date_action: f.date_action,
  referent: f.referent || null, statut: f.statut, budget: f.budget ? Number(f.budget) : null,
});

/** Enregistre l'action, puis ses tâches prévues (confiées au référent). Rend son identifiant, ou null. */
async function creerActionAvecTaches(champs: ChampsAction, tachesPrevues: TacheBrouillon[], tenant: string): Promise<number | null> {
  const creation = await supabase.from('actions').insert({ ...valeursAEnregistrer(champs), tenant_id: tenant }).select('id').single();
  if (creation.error) {
    toast(creation.error.message, 'error');
    return null;
  }
  const id = (creation.data as { id: number }).id;
  const taches = tachesPrevues.filter((t) => t.libelle.trim()).map((t) => ({
    action_id: id, tenant_id: tenant, libelle: t.libelle.trim(), responsable: champs.referent || null,
    echeance: t.echeance || null, priorite: t.priorite,
  }));
  const ajout = taches.length ? await supabase.from('taches').insert(taches) : { error: null };
  if (ajout.error) toast(`Action créée, mais les tâches n’ont pas pu être ajoutées : ${ajout.error.message}`, 'error');
  else toast(taches.length ? `Action créée avec ${taches.length} tâche${taches.length > 1 ? 's' : ''}` : 'Action créée');
  return id;
}

/** Ajouter, modifier, supprimer une tâche d'une action déjà créée : chaque geste s'enregistre aussitôt. */
function useTachesDeLAction(id: number | null, tenant: string, onChanged: () => void) {
  async function surLesTaches(requete: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await requete;
    if (error) return toast(error.message, 'error');
    onChanged();
  }
  return {
    ajouterTache: (t: NouvelleTache) => surLesTaches(supabase.from('taches').insert({
      action_id: id, tenant_id: tenant, libelle: t.libelle.trim(), responsable: t.responsable || null, echeance: t.echeance || null, priorite: t.priorite,
    })),
    modifierTache: (t: Tache, changement: Partial<Tache>) => surLesTaches(supabase.from('taches').update(changement).eq('id', t.id)),
    supprimerTache: (t: Tache) => surLesTaches(supabase.from('taches').delete().eq('id', t.id)),
  };
}

type Options = {
  action: Action | null; depart: BrouillonAction | null; moi: string; tenant: string;
  onChanged: () => void; onClose: () => void;
  /** L'action vient d'être créée : la page affiche désormais ses vraies tâches. */
  onCreee: (id: number) => void;
};

export function useFicheAction({ action, depart, moi, tenant, onChanged, onClose, onCreee }: Options) {
  const [id, setId] = useState<number | null>(action?.id ?? null);
  const [champs, setChamps] = useState<ChampsAction>({
    emoji: action?.emoji ?? depart?.emoji ?? '', titre: action?.titre ?? depart?.titre ?? '',
    date_action: action?.date_action ?? depart?.date_action ?? today(),
    referent: action?.referent ?? moi, statut: action?.statut ?? 'À faire', budget: action?.budget?.toString() ?? '',
  });
  const [tachesPrevues, setTachesPrevues] = useState<TacheBrouillon[]>(depart?.taches ?? []);
  const [enCours, setEnCours] = useState(false);
  const [etat, setEtat] = useState<'a_enregistrer' | 'enregistre' | null>(null);
  // La dernière version des champs, pour l'enregistrement différé et celui de la fermeture.
  const derniersChamps = useRef(champs);
  derniersChamps.current = champs;

  async function enregistrer() {
    if (!id || !derniersChamps.current.titre.trim()) return;
    const { error } = await supabase.from('actions').update(valeursAEnregistrer(derniersChamps.current)).eq('id', id);
    if (error) return toast(error.message, 'error');
    setEtat('enregistre');
    onChanged();
  }

  // Enregistrement automatique : un court délai après la dernière frappe.
  useEffect(() => {
    if (etat !== 'a_enregistrer' || !id) return;
    const minuteur = setTimeout(enregistrer, DELAI_ENREGISTREMENT_MS);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champs, etat, id]);

  function modifier<C extends keyof ChampsAction>(champ: C, valeur: ChampsAction[C]) {
    // La date d'une action pas encore créée emmène ses tâches avec elle.
    if (champ === 'date_action' && !id) setTachesPrevues((t) => decalerLesTaches(t, champs.date_action, valeur as string, today()));
    setChamps((avant) => ({ ...avant, [champ]: valeur }));
    if (id) setEtat('a_enregistrer');
  }

  function appliquerModele(modele: ModeleAction) {
    const brouillon = brouillonDepuisModele(modele, champs.date_action, today(), champs.titre);
    setChamps((avant) => ({ ...avant, emoji: avant.emoji || brouillon.emoji, titre: brouillon.titre }));
    setTachesPrevues(brouillon.taches);
  }

  async function creer() {
    setEnCours(true);
    const nouvelId = await creerActionAvecTaches(champs, tachesPrevues, tenant);
    setEnCours(false);
    if (nouvelId === null) return;
    setId(nouvelId);
    setTachesPrevues([]);
    onChanged();
    onCreee(nouvelId);
  }

  async function supprimer() {
    if (!id || !confirm(`Supprimer « ${champs.titre} » et toutes ses tâches ?`)) return;
    const { error } = await supabase.from('actions').delete().eq('id', id);
    if (error) return toast(error.message, 'error');
    toast('Action supprimée');
    onChanged();
    onClose();
  }

  const taches = useTachesDeLAction(id, tenant, onChanged);

  async function fermer() {
    const brouillonEntame = !id && (champs.titre.trim() !== '' || tachesPrevues.length > 0);
    if (brouillonEntame && !confirm('Fermer sans créer cette action ? Ce que vous avez préparé sera perdu.')) return;
    // Une modification encore en attente part tout de suite, avant de fermer.
    if (etat === 'a_enregistrer') await enregistrer();
    onClose();
  }

  return {
    id, champs, modifier, tachesPrevues, setTachesPrevues, appliquerModele, creer, supprimer,
    ...taches, fermer, enCours, etat,
  };
}

export type FicheActionEtat = ReturnType<typeof useFicheAction>;
