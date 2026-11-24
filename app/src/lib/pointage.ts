import { libelleDeTranche } from './creneaux';

// Le pointage du jour J (supabase/presences_benevoles.sql) : le bureau coche qui est vraiment venu.
// Sans pointage, une inscription compte comme tenue (bilan, remerciement du lendemain).
// Fichier identique dans l'app (app/src/lib/pointage.ts) et l'espace bureau (bureau/src/pointage.ts).

export type Presence = 'venu' | 'absent';
type InscritPointable = { id: number; pole_id: number; debut: string; presence?: Presence | null };
type PoleNomme = { id: number; nom: string };

export type TrancheAPointer<I extends InscritPointable> = { heure: string; libelle: string; inscrits: { inscrit: I; nomDuPole: string }[] };
export type ResumeDuPointage = { venus: number; absents: number; aPointer: number };

/** Les inscrits rangés par heure, puis par pôle dans l'ordre du planning : l'ordre d'arrivée sur place. */
export function tranchesAPointer<I extends InscritPointable>(planning: { poles: PoleNomme[]; inscrits: I[] }, dureeMinutes: number): TrancheAPointer<I>[] {
  const ordreDuPole = new Map(planning.poles.map((p, rang) => [p.id, rang]));
  const nomDuPole = new Map(planning.poles.map((p) => [p.id, p.nom]));
  const parHeure = new Map<string, TrancheAPointer<I>>();
  const tries = [...planning.inscrits].sort((a, b) =>
    a.debut.localeCompare(b.debut) || (ordreDuPole.get(a.pole_id) ?? 0) - (ordreDuPole.get(b.pole_id) ?? 0));
  for (const inscrit of tries) {
    const tranche = parHeure.get(inscrit.debut) ?? { heure: inscrit.debut, libelle: libelleDeTranche(inscrit.debut, dureeMinutes), inscrits: [] };
    tranche.inscrits.push({ inscrit, nomDuPole: nomDuPole.get(inscrit.pole_id) ?? '' });
    parHeure.set(inscrit.debut, tranche);
  }
  return [...parHeure.values()];
}

export function resumeDuPointage(inscrits: InscritPointable[]): ResumeDuPointage {
  const venus = inscrits.filter((i) => i.presence === 'venu').length;
  const absents = inscrits.filter((i) => i.presence === 'absent').length;
  return { venus, absents, aPointer: inscrits.length - venus - absents };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** « 12 venus · 2 absents · 5 à pointer », ou « Tout est pointé : 12 venus, 2 absents. » */
export function phraseDuPointage({ venus, absents, aPointer }: ResumeDuPointage): string {
  if (!venus && !absents) return aPointer ? `${pluriel(aPointer, 'personne')} à pointer` : 'Personne à pointer';
  if (!aPointer) return `Tout est pointé : ${pluriel(venus, 'venu')}, ${pluriel(absents, 'absent')}.`;
  const parties = [venus && pluriel(venus, 'venu'), absents && pluriel(absents, 'absent'), `${aPointer} à pointer`];
  return parties.filter(Boolean).join(' · ');
}

/** Toucher le bouton déjà choisi annule le pointage (erreur de doigt) ; sinon il le remplace. */
export const presenceApres = (actuelle: Presence | null | undefined, choix: Presence): Presence | null =>
  actuelle === choix ? null : choix;

/** Le jour local « AAAA-MM-JJ » : la date d'une action se compare au jour de l'association, pas à celui de Londres. */
export const jourLocal = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Après la date de l'action, on ne cherche plus de monde : on pointe et on fait le bilan. */
export const estActionPassee = (dateAction: string, aujourdhui: string) => dateAction < aujourdhui;

/** Le pointage s'ouvre le jour J. */
export const peutPointer = (dateAction: string, aujourdhui: string) => dateAction <= aujourdhui;
