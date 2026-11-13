import type { MemberRow } from './lib';

// Enregistrer ou effacer la cotisation d'un adhérent passe par deux chemins : la table cotisations
// pour un adhérent inscrit, la liste des adhérents importés (adherents_invites) pour les autres.

export type RequeteCotisation = { fonction: string; parametres: Record<string, unknown> };

/** La fonction à appeler pour donner à l'adhérent cette date de fin, ou aucune (null). */
export function requeteDeCotisation(membre: Pick<MemberRow, 'id' | 'email' | 'prenom' | 'nom'>, date: string | null): RequeteCotisation {
  if (membre.id) {
    return date
      ? { fonction: 'set_cotisation', parametres: { p_member: membre.id, p_valide_jusqu: date } }
      : { fonction: 'clear_cotisation', parametres: { p_member: membre.id } };
  }
  return date
    ? { fonction: 'importer_adherents', parametres: { p_rows: [{ prenom: membre.prenom ?? '', nom: membre.nom ?? '', email: membre.email, valide_jusqu: date }] } }
    : { fonction: 'effacer_cotisation_invite', parametres: { p_email: membre.email } };
}
