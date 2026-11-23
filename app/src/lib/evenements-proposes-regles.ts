// Les événements proposés par les membres (supabase/propositions_evenements.sql) : vérifier le
// formulaire, annoncer les séances d'un événement qui se répète, dire où en est une proposition.
// Sans accès à la base : testé à part (evenements-proposes-regles.test.ts). L'espace bureau en a une copie
// (bureau/src/evenements-proposes-regles.ts) : garder les deux identiques.

export type TypeDeProposition = 'a_organiser' | 'personnel';
export type Repetition = 'aucune' | 'semaine' | 'mois';
export type StatutDeProposition = 'en_attente' | 'acceptee' | 'refusee';

export type Proposition = {
  id: number;
  auteur: string;
  type: TypeDeProposition;
  titre: string;
  description: string;
  periode: string | null;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  repetition: Repetition;
  nb_mois: number | null;
  statut: StatutDeProposition;
  mot_du_bureau: string | null;
  devenue: 'evenement' | 'action' | null;
  evenement_id: number | null;
  idee_id: number | null;
  created_at: string;
};

export type ChampsDeProposition = {
  type: TypeDeProposition;
  titre: string;
  description: string;
  periode: string;
  date: string;
  heure: string;
  lieu: string;
  repetition: Repetition;
  nbMois: 3 | 6;
};

const joursDansLeMois = (annee: number, mois: number) => new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();

/** « AAAA-MM-JJ » plus n mois, le jour ramené à la fin des mois plus courts (le 31 → le 28 février). */
function ajouterDesMois(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  const annee = a + Math.floor((m - 1 + n) / 12);
  const mois = (m - 1 + n) % 12;
  const date = new Date(Date.UTC(annee, mois, Math.min(j, joursDansLeMois(annee, mois))));
  return date.toISOString().slice(0, 10);
}

function ajouterDesJours(jour: string, n: number): string {
  const date = new Date(`${jour}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/**
 * Les séances d'une série : chaque semaine ou chaque mois à partir de la première date, pendant
 * 3 ou 6 mois. Copie fidèle de seances_de_la_serie (supabase/propositions_evenements.sql).
 */
export function seancesDeLaSerie(debut: string, repetition: Repetition, nbMois: number): string[] {
  if (repetition === 'aucune') return [debut];
  const fin = ajouterDesMois(debut, nbMois);
  const seances: string[] = [];
  for (let n = 0; n <= 200; n++) {
    const seance = repetition === 'semaine' ? ajouterDesJours(debut, 7 * n) : ajouterDesMois(debut, n);
    if (seance >= fin) break;
    seances.push(seance);
  }
  return seances;
}

/** Ce qui manque au formulaire, dit simplement ; null quand tout est bon. */
export function erreurDeLaProposition(champs: ChampsDeProposition, aujourdhui: string): string | null {
  if (!champs.titre.trim()) return 'Donnez un nom à votre événement.';
  if (!champs.description.trim()) return 'Décrivez votre événement en quelques mots.';
  if (champs.type === 'personnel') {
    if (!champs.date) return 'Choisissez la date de votre événement.';
    if (champs.date < aujourdhui) return 'Cette date est déjà passée.';
    if (!champs.lieu.trim()) return 'Indiquez le lieu de votre événement.';
  }
  return null;
}

/** « 3 séances : 14 janv., 14 févr., 14 mars » ou « 13 séances, du 14 janv. au 8 avr. ». */
export function resumeDesSeances(seances: string[]): string {
  const court = (jour: string) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (seances.length <= 1) return seances.length ? `Le ${court(seances[0])}` : '';
  if (seances.length <= 6) return `${seances.length} séances : ${seances.map(court).join(', ')}`;
  return `${seances.length} séances, du ${court(seances[0])} au ${court(seances.at(-1)!)}`;
}

/** Le mot du statut, sur l'idée comme dans « Vos propositions ». */
export function libelleDuStatut(statut: StatutDeProposition): string {
  return { en_attente: 'En attente du bureau', acceptee: 'Acceptée', refusee: 'Pas retenue' }[statut];
}
