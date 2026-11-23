import { useEffect, useState } from 'react';

import type { Contact } from '../feuilleDeRoute';
import { supabase, toast } from '../lib';

// Pour la feuille de route : le référent de l'action (toujours imprimé) et, seulement quand le
// bureau coche « Avec les coordonnées », l'e-mail du compte et le téléphone de l'annuaire de
// chaque inscrit. On ne va chercher les coordonnées qu'à la demande : la feuille sans elles est
// celle qu'on affiche au stand.

export type Referent = { nom: string; contact: Contact };

/** Les coordonnées de ces membres : e-mail du compte, téléphone de leur fiche d'annuaire s'ils l'ont remplie. */
async function chargerLesContacts(membres: string[]): Promise<Map<string, Contact>> {
  const [comptes, fiches] = await Promise.all([
    supabase.from('profiles').select('id, email').in('id', membres),
    supabase.from('annuaire').select('user_id, telephone').in('user_id', membres),
  ]);
  const erreur = comptes.error ?? fiches.error;
  if (erreur) toast(erreur.message, 'error');
  const telephones = new Map((fiches.data ?? []).map((f) => [f.user_id as string, (f.telephone as string | null) ?? null]));
  return new Map((comptes.data ?? []).map((c) => [c.id as string, { email: (c.email as string | null) ?? null, telephone: telephones.get(c.id) ?? null }]));
}

/** Le nom du référent de l'action, et ses coordonnées pour qu'on puisse le joindre le jour J. */
async function chargerLeReferent(actionId: number): Promise<Referent | null> {
  const { data: action } = await supabase.from('actions').select('referent').eq('id', actionId).single();
  if (!action?.referent) return null;
  const [{ data: profil }, contacts] = await Promise.all([
    supabase.from('profiles').select('prenom, nom').eq('id', action.referent).single(),
    chargerLesContacts([action.referent]),
  ]);
  const nom = [profil?.prenom, profil?.nom].filter(Boolean).join(' ').trim();
  return nom ? { nom, contact: contacts.get(action.referent) ?? { email: null, telephone: null } } : null;
}

export function useContactsDesInscrits(actionId: number, membres: string[], avecCoordonnees: boolean) {
  const [referent, setReferent] = useState<Referent | null>(null);
  const [contacts, setContacts] = useState<Map<string, Contact> | null>(null);
  const cle = membres.join(',');

  useEffect(() => { chargerLeReferent(actionId).then(setReferent); }, [actionId]);

  useEffect(() => {
    if (!avecCoordonnees || !cle) { setContacts(null); return; }
    let estActuel = true;
    chargerLesContacts(cle.split(',')).then((trouves) => { if (estActuel) setContacts(trouves); });
    return () => { estActuel = false; };
  }, [avecCoordonnees, cle]);

  return { referent, contacts };
}
