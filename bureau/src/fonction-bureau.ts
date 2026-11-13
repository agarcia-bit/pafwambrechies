// La fonction de chacun au bureau (supabase/fonction_bureau.sql), affichée à côté de son nom.

export const FONCTIONS_COURANTES = ['Président', 'Présidente', 'Vice-président', 'Vice-présidente', 'Trésorier', 'Trésorière', 'Secrétaire', 'Membre du bureau'];

/** « Andy Agalumy · Vice-président », ou le nom seul. */
export const nomAvecFonction = (nom: string, fonction?: string | null) => (fonction?.trim() ? `${nom} · ${fonction.trim()}` : nom);
