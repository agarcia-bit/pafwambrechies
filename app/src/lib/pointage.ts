import { libelleDeTranche } from './creneaux';
import type { Inscrit, Planning, Presence } from './planning';

// Le pointage du jour J (supabase/presences_benevoles.sql) : le bureau coche qui est vraiment venu.
// Sans pointage, une inscription compte comme tenue (bilan, remerciement du lendemain).

export type TrancheAPointer = { heure: string; libelle: string; inscrits: { inscrit: Inscrit; nomDuPole: string }[] };
export type ResumeDuPointage = { venus: number; absents: number; aPointer: number };

/** Les inscrits rangés par heure, puis par pôle dans l'ordre du planning : l'ordre d'arrivée sur place. */
export function tranchesAPointer(planning: Pick<Planning, 'poles' | 'inscrits'>, dureeMinutes: number): TrancheAPointer[] {
  const ordreDuPole = new Map(planning.poles.map((p, rang) => [p.id, rang]));
  const nomDuPole = new Map(planning.poles.map((p) => [p.id, p.nom]));
  const parHeure = new Map<string, TrancheAPointer>();
  const tries = [...planning.inscrits].sort((a, b) =>
    a.debut.localeCompare(b.debut) || (ordreDuPole.get(a.pole_id) ?? 0) - (ordreDuPole.get(b.pole_id) ?? 0));
  for (const inscrit of tries) {
    const tranche = parHeure.get(inscrit.debut) ?? { heure: inscrit.debut, libelle: libelleDeTranche(inscrit.debut, dureeMinutes), inscrits: [] };
    tranche.inscrits.push({ inscrit, nomDuPole: nomDuPole.get(inscrit.pole_id) ?? '' });
    parHeure.set(inscrit.debut, tranche);
  }
  return [...parHeure.values()];
}

export function resumeDuPointage(inscrits: Inscrit[]): ResumeDuPointage {
  const venus = inscrits.filter((i) => i.presence === 'venu').length;
  const absents = inscrits.filter((i) => i.presence === 'absent').length;
  return { venus, absents, aPointer: inscrits.length - venus - absents };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** « 12 venus · 2 absents · 5 à pointer », ou « Tout est pointé : 12 venus, 2 absents. » */
export function phraseDuPointage({ venus, absents, aPointer }: ResumeDuPointage): string {
  if (!venus && !absents) return aPointer ? `${pluriel(aPointer, 'personne')} à pointer` : 'Personne à pointer';
  if (!aPointer) return `Tout est pointé : ${pluriel(venus, 'venu')}, ${pluriel(absents, 'absent')}.`;
  return `${pluriel(venus, 'venu')} · ${pluriel(absents, 'absent')} · ${aPointer} à pointer`;
}

/** Toucher le bouton déjà choisi annule le pointage (erreur de doigt) ; sinon il le remplace. */
export const presenceApres = (actuelle: Presence | null | undefined, choix: Presence): Presence | null =>
  actuelle === choix ? null : choix;
