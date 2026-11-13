import { fullName } from './format';

// Une fiche d'annuaire peut réunir plusieurs personnes d'une même entreprise : le titulaire et
// ses collègues (supabase/annuaire_collegues.sql). On les affiche ensemble sous le nom de l'entreprise.

export type ContactDeFiche = { prenom: string | null; nom: string | null };

/** « Ewan Ros, Marie Dupont » : le titulaire d'abord, sans doublon ni nom vide. */
export function nomsDesContacts(titulaire: ContactDeFiche, collegues: ContactDeFiche[]): string {
  const noms = [titulaire, ...collegues].map((c) => fullName(c.prenom, c.nom)).filter(Boolean);
  return [...new Set(noms)].join(', ');
}
