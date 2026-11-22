import { deposerPhoto, supabase } from './lib';

// Les retours sur l'application (bug ou idée), envoyés au propriétaire de la plateforme et non au
// bureau (supabase/retours.sql). Même table que l'app (app/src/lib/retours.ts).

export type TypeDeRetour = 'bug' | 'idee';
export type StatutDeRetour = 'nouveau' | 'en_cours' | 'fait';
export const LIBELLES_DES_TYPES: Record<TypeDeRetour, string> = { bug: 'Bug', idee: 'Idée' };
export const LIBELLES_DES_STATUTS: Record<StatutDeRetour, string> = { nouveau: 'Nouveau', en_cours: 'En cours', fait: 'Fait' };

export type Retour = {
  id: number; created_at: string; type: TypeDeRetour; texte: string; capture: string | null;
  appareil: Record<string, string>; statut: StatutDeRetour; auteur: string | null; email: string | null; association: string | null;
};

/** « Chrome · Mac · 1440×900 » : de quoi reproduire un bug signalé depuis l'espace bureau. */
export function appareilDuNavigateur(agent: string, largeur: number, hauteur: number) {
  const navigateur = [['Edg/', 'Edge'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari']].find(([marque]) => agent.includes(marque))?.[1] ?? 'Navigateur';
  const systeme = [['iPhone', 'iPhone'], ['iPad', 'iPad'], ['Android', 'Android'], ['Mac OS', 'Mac'], ['Windows', 'Windows'], ['Linux', 'Linux']].find(([marque]) => agent.includes(marque))?.[1] ?? 'système inconnu';
  return { support: 'espace bureau', systeme: `${navigateur} · ${systeme}`, ecran: `${largeur}×${hauteur}` };
}

/** Dépose la capture (facultative) dans le dossier de l'auteur, puis enregistre le retour. */
export async function envoyerUnRetour(auteur: string, type: TypeDeRetour, texte: string, capture: File | null) {
  const chemin = capture ? await deposerPhoto(capture, 'retours-captures', 1600, false, auteur) : null;
  const appareil = appareilDuNavigateur(navigator.userAgent, innerWidth, innerHeight);
  const { error } = await supabase.from('retours').insert({ type, texte: texte.trim(), capture: chemin, appareil });
  if (error) throw error;
}

/** Tous les retours, toutes associations : vide pour un compte qui n'est pas propriétaire de la plateforme. */
export async function chargerLesRetours(): Promise<Retour[]> {
  const { data, error } = await supabase.rpc('retours_de_la_plateforme');
  if (error) throw error;
  return (data ?? []) as Retour[];
}

export async function changerLeStatut(id: number, statut: StatutDeRetour) {
  const { error } = await supabase.from('retours').update({ statut }).eq('id', id);
  if (error) throw error;
}

/** Une adresse temporaire pour voir une capture (le rangement est privé). */
export async function lienDeLaCapture(chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from('retours-captures').createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

/** Le propriétaire de la plateforme voit la page « Retours ». */
export async function estProprietaireDeLaPlateforme(): Promise<boolean> {
  const { data } = await supabase.rpc('is_platform_admin');
  return data === true;
}
