import { formatDay, formatDayLong, isoDay, parseDay, venue } from './format';

// Un événement peut durer plusieurs jours (date_fin, facultative) : ces fonctions disent ses jours
// et les écrivent en français, pour l'agenda comme pour les réponses « je viens tel jour ».

type Periode = { date: string; date_fin?: string | null };

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function estSurPlusieursJours(ev: Periode): boolean {
  return !!ev.date_fin && ev.date_fin > ev.date;
}

/** Le dernier jour : l'événement reste à venir, et les réponses ouvertes, jusqu'à ce jour-là. */
export function dernierJour(ev: Periode): string {
  return estSurPlusieursJours(ev) ? ev.date_fin! : ev.date;
}

/** Tous les jours de l'événement, du premier au dernier, en "AAAA-MM-JJ". */
export function joursDeLEvenement(ev: Periode): string[] {
  const jours: string[] = [];
  const fin = dernierJour(ev);
  for (let jour = parseDay(ev.date); isoDay(jour) <= fin; jour.setDate(jour.getDate() + 1)) jours.push(isoDay(jour));
  return jours;
}

/** "Vendredi 12 juin 2026", ou "Du vendredi 12 au dimanche 14 juin 2026". */
export function formatPeriode(ev: Periode): string {
  if (!estSurPlusieursJours(ev)) return formatDayLong(ev.date);
  const debut = parseDay(ev.date);
  const fin = parseDay(ev.date_fin!);
  // Le mois et l'année du premier jour ne s'écrivent que s'ils diffèrent de ceux du dernier.
  const autreAnnee = debut.getFullYear() !== fin.getFullYear();
  const autreMois = autreAnnee || debut.getMonth() !== fin.getMonth();
  const premier = [JOURS[debut.getDay()], debut.getDate(), autreMois && MOIS[debut.getMonth()], autreAnnee && debut.getFullYear()]
    .filter(Boolean)
    .join(' ');
  return `Du ${premier} au ${JOURS[fin.getDay()]} ${formatDay(ev.date_fin!)}`;
}

/** "sam. 13" : un jour dans une liste de jours choisis. */
export function formatJourCourt(iso: string): string {
  const jour = parseDay(iso);
  return `${JOURS_COURTS[jour.getDay()]} ${jour.getDate()}`;
}

/** Les jours où vient un adhérent : aucun jour précisé veut dire toute la durée. */
export function resumerJoursChoisis(jours: string[] | null | undefined): string {
  if (!jours?.length) return 'Toute la durée';
  return [...jours].sort().map(formatJourCourt).join(', ');
}

/** La ligne sous le titre dans les listes : « Jusqu’au dimanche 14 juin · 09:00 – 18:00 · Salle des fêtes ». */
export function detailsEvenement(ev: Periode & { heure: string | null; lieu: string | null }): string {
  const fin = estSurPlusieursJours(ev) ? parseDay(ev.date_fin!) : null;
  const jusquAu = fin && `Jusqu’au ${JOURS[fin.getDay()]} ${fin.getDate()} ${MOIS[fin.getMonth()]}`;
  return [jusquAu, ev.heure, venue(ev.lieu)].filter(Boolean).join(' · ');
}

/** Combien de présents chaque jour : un présent sans jour précisé vient tous les jours. */
export function compterPresentsParJour(
  jours: string[],
  reponses: { reponse: string | null; jours?: string[] | null }[]
): { jour: string; presents: number }[] {
  const presents = reponses.filter((r) => r.reponse === 'present');
  return jours.map((jour) => ({
    jour,
    presents: presents.filter((r) => !r.jours?.length || r.jours.includes(jour)).length,
  }));
}
