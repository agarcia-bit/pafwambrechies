/** Au-delà, les lignes deviennent trop longues à lire (grand écran de l'iPhone Duo ouvert). */
export const LARGEUR_DE_LECTURE = 640;

export type Marges = { gauche: number; droite: number };

/**
 * Les marges qui gardent le contenu hors des bords occupés (l'heure et la barre d'onglets de
 * l'iPhone Duo) et le centrent dans une colonne lisible au-delà de 640 points.
 */
export function margesDeLecture(largeur: number, bords: Marges): Marges {
  const surplus = Math.max(0, Math.round((largeur - bords.gauche - bords.droite - LARGEUR_DE_LECTURE) / 2));
  return { gauche: bords.gauche + surplus, droite: bords.droite + surplus };
}
