// Des actions prêtes à l'emploi pour le Pilotage : un modèle donne le titre, l'icône et la liste des
// tâches habituelles, avec une échéance comptée en jours avant la date de l'action. Le bureau part
// d'une base réaliste au lieu d'une page blanche, puis ajuste.

export type Priorite = 'Haute' | 'Moyenne' | 'Basse';
type TacheModele = { libelle: string; joursAvant: number; priorite?: Priorite };
export type ModeleAction = { cle: string; emoji: string; titre: string; resume: string; taches: TacheModele[] };

export type TacheBrouillon = { libelle: string; echeance: string; priorite: Priorite };
/** Une action pas encore enregistrée : ce que la fiche affiche avant « Créer l'action ». */
export type BrouillonAction = { emoji: string; titre: string; date_action: string; taches: TacheBrouillon[] };

export const MODELES: ModeleAction[] = [
  {
    cle: 'evenement', emoji: '🎉', titre: 'Organiser un événement', resume: 'Lieu, invitation, relances, bilan',
    taches: [
      { libelle: 'Réserver le lieu et fixer l’horaire', joursAvant: 30, priorite: 'Haute' },
      { libelle: 'Créer l’événement dans l’agenda de l’app', joursAvant: 28 },
      { libelle: 'Publier une actu pour l’annoncer', joursAvant: 21 },
      { libelle: 'Envoyer l’invitation par e-mail', joursAvant: 21 },
      { libelle: 'Relancer ceux qui n’ont pas répondu', joursAvant: 7 },
      { libelle: 'Confirmer le nombre de participants (traiteur, salle)', joursAvant: 3, priorite: 'Haute' },
      { libelle: 'Publier les photos et remercier les participants', joursAvant: -2, priorite: 'Basse' },
    ],
  },
  {
    cle: 'ag', emoji: '🏛️', titre: 'Assemblée générale', resume: 'Convocation, rapports, compte rendu',
    taches: [
      { libelle: 'Fixer la date et réserver la salle', joursAvant: 45, priorite: 'Haute' },
      { libelle: 'Préparer le rapport moral et le rapport financier', joursAvant: 21 },
      { libelle: 'Envoyer la convocation et l’ordre du jour', joursAvant: 15, priorite: 'Haute' },
      { libelle: 'Relancer pour les présences et les pouvoirs', joursAvant: 5 },
      { libelle: 'Préparer la feuille d’émargement', joursAvant: 2 },
      { libelle: 'Rédiger et partager le compte rendu', joursAvant: -7 },
    ],
  },
  {
    cle: 'cotisations', emoji: '💰', titre: 'Campagne de cotisation', resume: 'Montant, annonce, relances, pointage',
    taches: [
      { libelle: 'Régler le montant, le lien de paiement et les dates de la campagne', joursAvant: 30, priorite: 'Haute' },
      { libelle: 'Annoncer la campagne (actu et e-mail)', joursAvant: 28 },
      { libelle: 'Première relance des cotisations manquantes', joursAvant: 14 },
      { libelle: 'Dernière relance', joursAvant: 3 },
      { libelle: 'Pointer les paiements reçus', joursAvant: 0 },
    ],
  },
];

/** "AAAA-MM-JJ" décalé de `jours` (négatif : avant). */
function decalerLeJour(iso: string, jours: number): string {
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

/** L'échéance d'une tâche : `joursAvant` jours avant l'action, jamais dans le passé. */
export function echeanceDeLaTache(dateAction: string, joursAvant: number, aujourdHui: string): string {
  const echeance = decalerLeJour(dateAction, -joursAvant);
  return echeance < aujourdHui ? aujourdHui : echeance;
}

/** L'action préremplie par un modèle, pour une date donnée ; `titre` remplace celui du modèle. */
export function brouillonDepuisModele(modele: ModeleAction, dateAction: string, aujourdHui: string, titre?: string): BrouillonAction {
  return {
    emoji: modele.emoji,
    titre: titre?.trim() || modele.titre,
    date_action: dateAction,
    taches: modele.taches.map((t) => ({
      libelle: t.libelle,
      echeance: echeanceDeLaTache(dateAction, t.joursAvant, aujourdHui),
      priorite: t.priorite ?? 'Moyenne',
    })),
  };
}

/** Préparer un événement de l'agenda : il existe déjà, donc pas de tâche « créer l'événement ». */
export function brouillonPourEvenement(evenement: { titre: string; date: string }, aujourdHui: string): BrouillonAction {
  const modele = MODELES[0];
  const sansCreation = { ...modele, taches: modele.taches.filter((t) => !t.libelle.startsWith('Créer l’événement')) };
  return brouillonDepuisModele(sansCreation, evenement.date, aujourdHui, `Préparer : ${evenement.titre}`);
}

/**
 * Quand la date d'une action pas encore créée change, ses tâches suivent du même nombre de jours
 * (sans repasser dans le passé) : les retouches faites à la main sont gardées.
 */
export function decalerLesTaches(taches: TacheBrouillon[], ancienneDate: string, nouvelleDate: string, aujourdHui: string): TacheBrouillon[] {
  const jours = Math.round((Date.parse(nouvelleDate + 'T12:00:00Z') - Date.parse(ancienneDate + 'T12:00:00Z')) / 86400000);
  if (!jours || Number.isNaN(jours)) return taches;
  return taches.map((t) => {
    const echeance = t.echeance ? decalerLeJour(t.echeance, jours) : t.echeance;
    return { ...t, echeance: echeance && echeance < aujourdHui ? aujourdHui : echeance };
  });
}

export const brouillonVide = (aujourdHui: string): BrouillonAction => ({ emoji: '', titre: '', date_action: aujourdHui, taches: [] });
