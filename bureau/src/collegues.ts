import { fullName, supabase, type MemberRow } from './lib';

// Les collègues rattachés à une fiche d'annuaire (supabase/annuaire_collegues.sql) : plusieurs
// personnes d'une même entreprise, une seule fiche.

export type Collegue = { fiche_id: number; email: string; user_id: string | null; prenom: string | null; nom: string | null };
export type FicheResumee = { id: number; nom_entreprise: string; email: string | null };

export async function chargerCollegues(ficheId: number): Promise<Collegue[]> {
  const { data, error } = await supabase.from('annuaire_collegues').select('fiche_id, email, user_id, prenom, nom').eq('fiche_id', ficheId);
  if (error) throw error;
  return data as Collegue[];
}

export async function chargerFichesResumees(): Promise<FicheResumee[]> {
  const { data, error } = await supabase.from('annuaire').select('id, nom_entreprise, email').order('nom_entreprise');
  if (error) throw error;
  return data as FicheResumee[];
}

export const ajouterCollegue = (fiche: number, personne: { email: string; prenom: string; nom: string }, supprimerSaFiche: boolean) =>
  supabase.rpc('ajouter_collegue', { p_fiche: fiche, p_email: personne.email, p_prenom: personne.prenom, p_nom: personne.nom, p_supprimer_sa_fiche: supprimerSaFiche });

export const retirerCollegue = (fiche: number, email: string) => supabase.rpc('retirer_collegue', { p_fiche: fiche, p_email: email });

/** Les adhérents qu'on peut rattacher : ceux qui ont une adresse, hors titulaire et collègues déjà là. */
export function candidatsCollegues(membres: MemberRow[], collegues: Collegue[], emailDeLaFiche: string | null): MemberRow[] {
  const exclus = new Set([...collegues.map((c) => c.email), (emailDeLaFiche ?? '').trim().toLowerCase()]);
  return membres
    .filter((m) => m.email && !exclus.has(m.email.trim().toLowerCase()))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
}
