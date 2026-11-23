// Les créneaux de présence d'une action (supabase/creneaux.sql) : découper les horaires en
// tranches, savoir combien de personnes il faut sur un pôle à une heure donnée, et dire l'état
// d'une case. Les heures s'écrivent toujours « HH:MM », comme la base les renvoie.

export type Horaires = { debut: string; fin: string; dureeMinutes: number };
export type Pole = { id: number; nom: string; personnes: number; besoins_par_creneau: Record<string, number>; ordre: number };
export type EtatDuCreneau = 'vous' | 'libre' | 'derniere' | 'complet' | 'ferme';

export const DUREES_DE_TRANCHE = [30, 60, 90, 120, 180, 240] as const;

/** « 10:00:00 » ou « 10:00 » → minutes depuis minuit. */
export function minutesDe(heure: string): number {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes depuis minuit → « HH:MM ». */
export function heureDe(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Le début de chaque tranche entière entre l'ouverture et la fermeture (10:00, 12:00…). */
export function tranchesDeLaJournee({ debut, fin, dureeMinutes }: Horaires): string[] {
  if (dureeMinutes <= 0) return [];
  const tranches: string[] = [];
  for (let m = minutesDe(debut); m + dureeMinutes <= minutesDe(fin); m += dureeMinutes) tranches.push(heureDe(m));
  return tranches;
}

/** « 10 h – 12 h », « 9 h 30 – 11 h » : l'étiquette d'une tranche. */
export function libelleDeTranche(debut: string, dureeMinutes: number): string {
  const ecrire = (minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  };
  const depart = minutesDe(debut);
  return `${ecrire(depart)} – ${ecrire(depart + dureeMinutes)}`;
}

/** Combien il faut de personnes sur ce pôle à cette heure : l'exception de la tranche, sinon le nombre du pôle. */
export function besoinDuCreneau(pole: Pick<Pole, 'personnes' | 'besoins_par_creneau'>, heure: string): number {
  return pole.besoins_par_creneau[heure] ?? pole.personnes;
}

/** Le nouveau jeu d'exceptions quand on change le besoin d'une tranche ; revenir au nombre du pôle efface l'exception. */
export function changerLeBesoin(pole: Pick<Pole, 'personnes' | 'besoins_par_creneau'>, heure: string, besoin: number): Record<string, number> {
  const exceptions = { ...pole.besoins_par_creneau };
  if (besoin === pole.personnes) delete exceptions[heure];
  else exceptions[heure] = Math.max(0, besoin);
  return exceptions;
}

/** L'état d'une case, du point de vue d'une personne : la sienne, des places, la dernière, complet, ou pas ouverte. */
export function etatDuCreneau({ besoin, pris, estAMoi }: { besoin: number; pris: number; estAMoi: boolean }): EtatDuCreneau {
  if (estAMoi) return 'vous';
  if (besoin === 0) return 'ferme';
  const libres = besoin - pris;
  if (libres <= 0) return 'complet';
  return libres === 1 ? 'derniere' : 'libre';
}

/** Le mot écrit sur la case : l'état se lit sans la couleur. */
export function libelleDeLEtat(etat: EtatDuCreneau, libres: number): string {
  switch (etat) {
    case 'vous': return 'Vous';
    case 'libre': return `${libres} places libres`;
    case 'derniere': return 'Dernière place';
    case 'complet': return 'Complet';
    case 'ferme': return 'Pas besoin';
  }
}

/** Le total des places de l'action et combien sont prises : pour le résumé « 7 places libres sur 18 ». */
export function bilanDesPlaces(poles: Pole[], tranches: string[], prisPar: (pole: number, heure: string) => number) {
  let places = 0;
  let prises = 0;
  for (const pole of poles) {
    for (const heure of tranches) {
      const besoin = besoinDuCreneau(pole, heure);
      places += besoin;
      prises += Math.min(besoin, prisPar(pole.id, heure));
    }
  }
  return { places, prises, libres: places - prises };
}

export type EtatPourLeBureau = 'rempli' | 'manque' | 'ferme';

/**
 * Le bureau regarde les trous, pas les places : une case remplie est une bonne nouvelle (vert),
 * une case où il manque du monde est à surveiller (ambre), une case sans besoin reste grise.
 */
export function etatPourLeBureau(besoin: number, pris: number): EtatPourLeBureau {
  if (besoin === 0) return 'ferme';
  return pris >= besoin ? 'rempli' : 'manque';
}

type InscritDuPlanning = { id: number; pole_id: number; debut: string; membre: string | null; nom: string; a_reprendre?: boolean };

/** « Julien (à reprendre) » : la personne cherche un remplaçant, la place reste à son nom (supabase/creneaux.sql, section 9). */
export const avecMentionDeReprise = (nom: string, aReprendre?: boolean) => (aReprendre ? `${nom} (à reprendre)` : nom);

/** Les créneaux d'une personne, dans l'ordre de la journée, avec le prénom des autres présents. */
export function billetsDeLaPersonne<T extends InscritDuPlanning>(poles: Pole[], inscrits: T[], moi: string) {
  return inscrits
    .filter((i) => i.membre === moi)
    .map((i) => ({
      inscrit: i,
      nomDuPole: poles.find((p) => p.id === i.pole_id)?.nom ?? '',
      avec: inscrits.filter((autre) => autre.id !== i.id && autre.pole_id === i.pole_id && autre.debut === i.debut).map((autre) => autre.nom),
    }))
    .sort((a, b) => a.inscrit.debut.localeCompare(b.inscrit.debut));
}

/** Vrai quand la personne tient déjà un poste à cette heure-là (on ne peut pas être à deux pôles à la fois). */
export const estDejaPrisALHeure = (inscrits: InscritDuPlanning[], moi: string, heure: string) =>
  inscrits.some((i) => i.membre === moi && i.debut === heure);

/** Un créneau d'un pôle : ce qui manque, qui est là (« vous » pour soi) et si l'on y est soi-même. */
export type Trou = { pole: Pole; heure: string; manque: number; presents: string[]; estMoi: boolean };

/** Tous les créneaux qui demandent du monde, pôle par pôle dans l'ordre de la journée, avec ce qui manque (0 si complet). */
export function creneauxDuPlanning<T extends InscritDuPlanning>(poles: Pole[], tranches: string[], inscrits: T[], moi?: string): Trou[] {
  const creneaux: Trou[] = [];
  for (const pole of poles) {
    for (const heure of tranches) {
      const besoin = besoinDuCreneau(pole, heure);
      if (besoin === 0) continue;
      const ici = inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure);
      creneaux.push({
        pole, heure, manque: Math.max(0, besoin - ici.length),
        presents: ici.map((i) => avecMentionDeReprise(moi && i.membre === moi ? 'vous' : i.nom, i.a_reprendre)), estMoi: ici.some((i) => !!moi && i.membre === moi),
      });
    }
  }
  return creneaux;
}

/** Les créneaux où il manque du monde, du plus urgent (le plus de places vides) au moins urgent, puis dans l'ordre de la journée. */
export function trousDuPlanning<T extends InscritDuPlanning>(poles: Pole[], tranches: string[], inscrits: T[], moi?: string): Trou[] {
  return creneauxDuPlanning(poles, tranches, inscrits, moi)
    .filter((c) => c.manque > 0)
    .sort((a, b) => b.manque - a.manque || minutesDe(a.heure) - minutesDe(b.heure));
}

/** « Il manque 8 personnes, surtout à la Buvette » : le total des places vides et le pôle qui en a le plus. */
export function resumeDesTrous(trous: Trou[]): { manque: number; poleLePlusEnManque: string | null } {
  const parPole = new Map<string, number>();
  for (const t of trous) parPole.set(t.pole.nom, (parPole.get(t.pole.nom) ?? 0) + t.manque);
  const classement = [...parPole.entries()].sort((a, b) => b[1] - a[1]);
  // « Surtout » n'a de sens que si un pôle se détache des autres.
  const seDetache = classement.length > 1 && classement[0][1] > classement[1][1];
  return { manque: trous.reduce((total, t) => total + t.manque, 0), poleLePlusEnManque: seDetache ? classement[0][0] : null };
}

/**
 * Le message proposé pour relancer les membres, que le bureau peut retoucher : quoi, quand, combien
 * il manque, et le créneau le plus urgent. « Marché de Noël samedi 12 décembre : il manque 8
 * personnes, surtout au pôle Buvette (12 h – 14 h). Un créneau vous tente ? »
 */
export function messageDeRelance(titre: string, quand: string, trous: Trou[], dureeMinutes: number): string {
  const { manque, poleLePlusEnManque } = resumeDesTrous(trous);
  if (!manque) return `${titre} ${quand} : tous les créneaux sont pris, merci à tous !`;
  const plusUrgent = poleLePlusEnManque ? trous.find((t) => t.pole.nom === poleLePlusEnManque) : trous[0];
  const ou = poleLePlusEnManque && plusUrgent ? `, surtout au pôle ${poleLePlusEnManque} (${libelleDeTranche(plusUrgent.heure, dureeMinutes)})` : '';
  return `${titre} ${quand} : il manque ${manque} personne${manque > 1 ? 's' : ''}${ou}. Un créneau vous tente ?`;
}

/** Une relance déjà partie (supabase/relances_planning.sql). */
export type Relance = { created_at: string; nb_notifications: number; nb_emails: number };

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/** Vrai si la relance a moins de 24 h : la fenêtre demande alors confirmation avant de relancer. */
export const estRecente = (relance: Relance | null, maintenant = Date.now()) =>
  !!relance && maintenant - new Date(relance.created_at).getTime() < UN_JOUR_MS;

/** Ce que dit l'écran après « M'envoyer un essai », selon les voies par lesquelles il est parti. */
export function texteDeLEssai({ nb_notifications: notification, nb_emails: email }: { nb_notifications: number; nb_emails: number }): string {
  if (notification && email) return 'Essai envoyé : regardez votre téléphone et votre boîte mail.';
  if (notification) return 'Essai envoyé sur votre téléphone.';
  if (email) return 'Essai envoyé par e-mail (pas d’app enregistrée sur votre téléphone).';
  return 'L’essai n’a pas pu partir : ni téléphone ni e-mail connus pour votre compte.';
}

/** « hier à 18 h », « aujourd'hui à 9 h 05 », « le 3 décembre à 18 h » */
export function quandEstCe(iso: string, maintenant = new Date()): string {
  const date = new Date(iso);
  const jour = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const hier = new Date(maintenant.getTime() - UN_JOUR_MS);
  const heure = date.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ').replace(' h 00', ' h');
  if (jour(date) === jour(maintenant)) return `aujourd’hui à ${heure}`;
  if (jour(date) === jour(hier)) return `hier à ${heure}`;
  return `le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${heure}`;
}
