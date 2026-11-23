// La feuille de route du jour J (bouton « Imprimer la feuille de route » de la page Planning) :
// pour chaque pôle, chaque tranche horaire avec les noms de ceux qui y sont, puis des lignes
// « à pourvoir » à remplir au stylo le jour même. Sans accès à la base : testé à part.

import { avecMentionDeReprise, besoinDuCreneau, libelleDeTranche, type Pole } from './creneaux';

/** Les coordonnées d'un membre, imprimées seulement si le bureau coche « Avec les coordonnées ». */
export type Contact = { email: string | null; telephone: string | null };

/** Une ligne de la feuille : une personne, ou une place vide (nom null) à remplir à la main. */
export type LigneDeFeuille = { nom: string | null; contact: Contact | null };
export type TrancheDeFeuille = { heure: string; libelle: string; lignes: LigneDeFeuille[] };
export type PoleDeFeuille = { nom: string; tranches: TrancheDeFeuille[] };

type Inscrit = { pole_id: number; debut: string; membre: string | null; nom: string; a_reprendre?: boolean };

/** Les lignes d'une tranche : les inscrits par ordre alphabétique, puis une ligne vide par place libre. */
function lignesDeLaTranche(pole: Pole, heure: string, inscrits: Inscrit[], contacts: Map<string, Contact> | null): LigneDeFeuille[] {
  const ici = inscrits
    .filter((i) => i.pole_id === pole.id && i.debut === heure)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const vides = Math.max(0, besoinDuCreneau(pole, heure) - ici.length);
  return [
    // « à reprendre » : la personne cherche un remplaçant, le responsable sait qu'il faudra peut-être un autre nom.
    ...ici.map((i) => ({ nom: avecMentionDeReprise(i.nom, i.a_reprendre), contact: (contacts && i.membre && contacts.get(i.membre)) || null })),
    ...Array.from({ length: vides }, () => ({ nom: null, contact: null })),
  ];
}

/**
 * La feuille entière, pôle par pôle dans l'ordre du planning. Une tranche fermée (besoin 0) sans
 * personne n'apparaît pas ; un pôle sans aucune tranche non plus.
 */
export function feuilleDeRoute(poles: Pole[], tranches: string[], dureeMinutes: number, inscrits: Inscrit[], contacts: Map<string, Contact> | null): PoleDeFeuille[] {
  return poles
    .map((pole) => ({
      nom: pole.nom,
      tranches: tranches
        .map((heure) => ({ heure, libelle: libelleDeTranche(heure, dureeMinutes), lignes: lignesDeLaTranche(pole, heure, inscrits, contacts) }))
        .filter((t) => t.lignes.length > 0),
    }))
    .filter((p) => p.tranches.length > 0);
}

/** « 0619425918 » → « 06 19 42 59 18 » : un numéro français se recopie mieux par paires. Les autres restent tels quels. */
export function telephoneLisible(telephone: string): string {
  const chiffres = telephone.replace(/[\s.-]/g, '');
  return /^0\d{9}$/.test(chiffres) ? chiffres.replace(/(\d{2})(?=\d)/g, '$1 ') : telephone.trim();
}

/** « e-mail · téléphone », ce qui est connu ; vide si rien. */
export const texteDuContact = (contact: Contact | null) =>
  [contact?.email?.trim(), contact?.telephone?.trim() && telephoneLisible(contact.telephone)].filter(Boolean).join(' · ');

/** « Imprimée le 23 novembre à 15 h 40 » : sur papier, « aujourd'hui » ne voudrait plus rien dire le lendemain. */
export function mentionDImpression(date: Date): string {
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ').replace(' h 00', ' h');
  return `Imprimée le ${jour} à ${heure}`;
}
