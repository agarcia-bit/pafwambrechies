// Ouvertures des e-mails du bureau (supabase/envois_ouvertures.sql). Seuls les e-mails envoyés
// depuis la mise en place du suivi ont une référence Resend : les autres ne comptent ni comme
// ouverts ni comme « pas ouverts ».

export type DestinataireSuivi = { statut: string; resend_id?: string | null; ouvert_le?: string | null };

/** Combien ont ouvert, parmi ceux dont l'ouverture peut être suivie. */
export function resumeDesOuvertures(destinataires: DestinataireSuivi[]): { ouverts: number; suivis: number } {
  const suivis = destinataires.filter((d) => d.statut !== 'echec' && d.resend_id);
  return { ouverts: suivis.filter((d) => d.ouvert_le).length, suivis: suivis.length };
}

/** « Ouvert le 13 nov. à 18:02 », « Pas encore ouvert », ou rien si l'e-mail n'est pas suivi. */
export function etatDOuverture(destinataire: DestinataireSuivi): string | null {
  if (destinataire.statut === 'echec' || !destinataire.resend_id) return null;
  if (!destinataire.ouvert_le) return 'Pas encore ouvert';
  const jour = new Date(destinataire.ouvert_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const heure = new Date(destinataire.ouvert_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Ouvert le ${jour} à ${heure}`;
}
