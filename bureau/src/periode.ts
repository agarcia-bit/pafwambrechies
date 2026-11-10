import { formatDay, today } from './lib';

// Un événement peut durer plusieurs jours (date_fin, facultative, supabase/evenements_plusieurs_jours.sql).
// Pour un tel événement, un adhérent présent peut préciser ses jours (aucun = toute la durée) et un mot.

type Periode = { date: string; date_fin?: string | null };

export function estSurPlusieursJours(ev: Periode): boolean {
  return !!ev.date_fin && ev.date_fin > ev.date;
}

/** Le dernier jour : l'événement reste « à venir » jusqu'à ce jour-là. */
export function dernierJour(ev: Periode): string {
  return estSurPlusieursJours(ev) ? ev.date_fin! : ev.date;
}

export const estPasse = (ev: Periode) => dernierJour(ev) < today();

/** Filtre Supabase (.or) des événements pas encore terminés. */
export const filtreNonTermines = () => `date.gte.${today()},date_fin.gte.${today()}`;

/** « 12 juin 2026 », ou « 12 juin 2026 → 14 juin 2026 ». */
export function formatPeriode(ev: Periode): string {
  return estSurPlusieursJours(ev) ? `${formatDay(ev.date)} → ${formatDay(ev.date_fin!)}` : formatDay(ev.date);
}

/** Tous les jours de l'événement, en "AAAA-MM-JJ". */
export function joursDeLEvenement(ev: Periode): string[] {
  const jours: string[] = [];
  const jour = new Date(ev.date + 'T12:00:00Z');
  for (let iso = ev.date; iso <= dernierJour(ev); iso = jour.toISOString().slice(0, 10)) {
    jours.push(iso);
    jour.setUTCDate(jour.getUTCDate() + 1);
  }
  return jours;
}

/** « sam. 13 » */
export const formatJourCourt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

/** Les jours où vient un adhérent : aucun jour précisé veut dire toute la durée. */
export function resumerJoursChoisis(jours: string[] | null | undefined): string {
  if (!jours?.length) return 'toute la durée';
  return [...jours].sort().map(formatJourCourt).join(', ');
}

/** Combien de présents chaque jour : un présent sans jour précisé vient tous les jours. */
export function compterPresentsParJour(
  jours: string[],
  reponses: { reponse: string | null; jours?: string[] | null }[]
): { jour: string; presents: number }[] {
  const presents = reponses.filter((r) => r.reponse === 'present');
  return jours.map((jour) => ({ jour, presents: presents.filter((r) => !r.jours?.length || r.jours.includes(jour)).length }));
}
