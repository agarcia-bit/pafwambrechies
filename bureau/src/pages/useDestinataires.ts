import { useMemo, useState } from 'react';

import {
  construireAudiences,
  emailsDuGroupe,
  type Audience,
  type FicheAnnuaire,
  type GroupeEnregistre,
} from '../groupes-destinataires';
import { loadMembers, supabase, toast, useAsync } from '../lib';

// L'état du choix des destinataires d'un message : l'audience choisie, la liste cochée à la main,
// et les groupes que le bureau enregistre pour les réutiliser (supabase/groupes_envoi.sql).

export const AUDIENCE_CHOIX = 'choix';

async function chargerFichesAnnuaire(): Promise<FicheAnnuaire[]> {
  const { data, error } = await supabase.from('annuaire').select('nom_entreprise, categorie, email, user_id');
  if (error) throw error;
  return data as FicheAnnuaire[];
}

async function chargerGroupesEnvoi(): Promise<GroupeEnregistre[]> {
  const { data, error } = await supabase.from('groupes_envoi').select('id, nom, emails');
  if (error) throw error;
  return data as GroupeEnregistre[];
}

export function useDestinataires() {
  const membres = useAsync(loadMembers, []);
  const fiches = useAsync(chargerFichesAnnuaire, []);
  const groupes = useAsync(chargerGroupesEnvoi, []);
  const [cle, setCle] = useState('tous');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  // Le groupe enregistré dont on modifie la liste, s'il y en a un.
  const [groupeEnEdition, setGroupeEnEdition] = useState<{ id: number; nom: string } | null>(null);

  const avecEmail = useMemo(() => (membres.data ?? []).filter((m) => m.email), [membres.data]);
  const audiences = useMemo(
    () => construireAudiences(membres.data ?? [], fiches.data ?? [], groupes.data ?? []),
    [membres.data, fiches.data, groupes.data]
  );
  const audience = audiences.find((a) => a.cle === cle);
  const destinataires = cle === AUDIENCE_CHOIX ? avecEmail.filter((m) => coches.has(m.key)) : audience?.membres ?? [];

  function choisir(nouvelleCle: string) {
    if (nouvelleCle !== AUDIENCE_CHOIX) setGroupeEnEdition(null);
    setCle(nouvelleCle);
  }

  function basculer(key: string) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(key)) apres.delete(key);
      else apres.add(key);
      return apres;
    });
  }

  function modifierGroupe(groupe: Audience) {
    setCoches(new Set(groupe.membres.map((m) => m.key)));
    setGroupeEnEdition({ id: groupe.groupeId!, nom: groupe.libelle });
    setCle(AUDIENCE_CHOIX);
  }

  async function enregistrerGroupe(nom: string) {
    const valeurs = { nom: nom.trim(), emails: emailsDuGroupe(destinataires) };
    const requete = groupeEnEdition
      ? supabase.from('groupes_envoi').update(valeurs).eq('id', groupeEnEdition.id).select('id').single()
      : supabase.from('groupes_envoi').insert(valeurs).select('id').single();
    const { data, error } = await requete;
    if (error || !data) return toast('Groupe non enregistré : ' + (error?.message ?? 'réessayez.'), 'error');
    toast(`Groupe « ${valeurs.nom} » enregistré.`);
    setGroupeEnEdition(null);
    setCoches(new Set());
    groupes.reload();
    setCle(`groupe:${data.id}`);
  }

  async function supprimerGroupe(groupe: Audience) {
    if (!confirm(`Supprimer le groupe « ${groupe.libelle} » ? Les adhérents ne sont pas touchés.`)) return;
    const { error } = await supabase.from('groupes_envoi').delete().eq('id', groupe.groupeId!);
    if (error) return toast('Suppression impossible : ' + error.message, 'error');
    groupes.reload();
    setCle('tous');
  }

  return {
    chargement: membres.loading && !membres.data,
    audiences,
    audience,
    cle,
    choisir,
    coches,
    basculer,
    toutDecocher: () => setCoches(new Set()),
    avecEmail,
    destinataires,
    groupeEnEdition,
    modifierGroupe,
    enregistrerGroupe,
    supprimerGroupe,
  };
}

export type EtatDestinataires = ReturnType<typeof useDestinataires>;
