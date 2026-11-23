// Les règles des notifications des créneaux de présence (supabase/creneaux.sql), sans accès à la
// base ni au réseau : testées à part (creneaux.test.ts), appliquées par index.ts.
//  * un adhérent se désinscrit : le référent de l'action est prévenu, la place est libre ;
//  * la veille de l'action, à partir de 9 h : chaque inscrit reçoit un rappel de ses créneaux.

export type InscriptionANotifier = {
  id: number;
  tenant_id: string;
  debut: string; // « HH:MM:SS »
  membre: string | null;
  annulee_le: string | null;
  annulation_notifiee: boolean;
  rappel_veille_le: string | null;
  poles: {
    nom: string;
    actions: { id: number; titre: string; date_action: string; referent: string | null; creneau_duree_minutes: number | null };
  };
};

export type Desistement = { tenantId: string; referent: string; actionId: number; membre: string | null; texteDuCreneau: string };
export type RappelDeLaVeille = { tenantId: string; membre: string; actionId: number; titre: string; creneaux: string[]; ids: number[] };

/** « 10 h – 12 h », « 9 h 30 – 11 h ». */
export function libelleDeTranche(debut: string, dureeMinutes: number): string {
  const [h, m] = debut.split(":").map(Number);
  const ecrire = (minutes: number) => {
    const heures = Math.floor(minutes / 60) % 24;
    const reste = minutes % 60;
    return reste ? `${heures} h ${String(reste).padStart(2, "0")}` : `${heures} h`;
  };
  const depart = h * 60 + (m || 0);
  return `${ecrire(depart)} – ${ecrire(depart + dureeMinutes)}`;
}

export const creneauDe = (i: InscriptionANotifier) =>
  `${i.poles.nom}, ${libelleDeTranche(i.debut, i.poles.actions.creneau_duree_minutes ?? 60)}`;

/** Les désinscriptions à annoncer au référent ; personne à prévenir quand il n'y a pas de référent ou qu'il s'agit de lui. */
export function desistementsAPrevenir(inscriptions: InscriptionANotifier[]): Desistement[] {
  return inscriptions
    .filter((i) => i.annulee_le && !i.annulation_notifiee)
    .filter((i) => i.poles.actions.referent && i.poles.actions.referent !== i.membre)
    .map((i) => ({
      tenantId: i.tenant_id, referent: i.poles.actions.referent!, actionId: i.poles.actions.id, membre: i.membre, texteDuCreneau: creneauDe(i),
    }));
}

export function texteDuDesistement(prenom: string | null, titre: string, creneau: string): string {
  return `${prenom ?? "Un membre"} ne peut plus venir à « ${titre} » (${creneau}). La place est de nouveau libre.`;
}

/** Un rappel par personne et par action, pour les inscriptions en cours d'une action qui a lieu demain. */
export function rappelsDeLaVeille(inscriptions: InscriptionANotifier[], demain: string): RappelDeLaVeille[] {
  const parCle = new Map<string, RappelDeLaVeille>();
  for (const i of inscriptions) {
    if (!i.membre || i.annulee_le || i.rappel_veille_le || i.poles.actions.date_action !== demain) continue;
    const cle = `${i.membre}|${i.poles.actions.id}`;
    const rappel = parCle.get(cle) ?? { tenantId: i.tenant_id, membre: i.membre, actionId: i.poles.actions.id, titre: i.poles.actions.titre, creneaux: [], ids: [] };
    rappel.creneaux.push(creneauDe(i));
    rappel.ids.push(i.id);
    parCle.set(cle, rappel);
  }
  return [...parCle.values()];
}

export function texteDuRappelDeLaVeille(rappel: RappelDeLaVeille): string {
  return `Demain, « ${rappel.titre} » : ${rappel.creneaux.join(" · ")}. Merci pour votre aide !`;
}
