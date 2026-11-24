import type { Presence } from './pointage';

// Après une action, une actu « Merci aux bénévoles » prête à relire : le bureau l'ouvre depuis le
// planning, la corrige s'il veut, puis la publie lui-même. Aucun nom n'y figure.

type Inscrit = { membre: string | null; nom: string; presence?: Presence | null };

/** Combien de créneaux tenus et par combien de personnes ; un absent pointé ne compte pas. */
export function bilanDeLaJournee(inscrits: Inscrit[]): { creneaux: number; benevoles: number } {
  const tenus = inscrits.filter((i) => i.presence !== 'absent');
  const personnes = new Set(tenus.map((i) => i.membre ?? `libre:${i.nom.trim().toLowerCase()}`));
  return { creneaux: tenus.length, benevoles: personnes.size };
}

/** Le titre et le texte de l'actu. `quand` est la date en toutes lettres (« samedi 12 décembre »). */
export function actuDeRemerciement(titreAction: string, quand: string, inscrits: Inscrit[]): { titre: string; contenu: string } {
  const { creneaux, benevoles } = bilanDeLaJournee(inscrits);
  const bilan = creneaux
    ? `${quand.charAt(0).toUpperCase()}${quand.slice(1)}, ${benevoles} bénévole${benevoles > 1 ? 's' : ''} ${benevoles > 1 ? 'ont' : 'a'} tenu ${creneaux} créneau${creneaux > 1 ? 'x' : ''}.`
    : `${quand.charAt(0).toUpperCase()}${quand.slice(1)}, l’association était au rendez-vous.`;
  return {
    titre: `Merci aux bénévoles de « ${titreAction} » !`,
    contenu: `${bilan} Merci à chacun pour son temps et sa bonne humeur : sans vous, rien n’aurait été possible. À la prochaine !`,
  };
}

/** L'adresse qui ouvre le formulaire d'une nouvelle actu déjà rempli (page Actus de l'espace bureau). */
export const adresseDeLActuPreremplie = (actu: { titre: string; contenu: string }) =>
  `#actus?${new URLSearchParams({ nouveau: '1', titre: actu.titre, contenu: actu.contenu }).toString()}`;
