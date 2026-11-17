// Les règles des notifications du Pilotage, sans accès à la base ni au réseau : testées à part
// (regles.test.ts), appliquées par index.ts.

export type TacheANotifier = {
  id: number;
  tenant_id: string;
  action_id: number;
  libelle: string;
  responsable: string | null;
  echeance: string | null; // « AAAA-MM-JJ »
  statut: string;
  confiee_par: string | null;
  confiee_notifiee: boolean;
  rappel_veille_le: string | null;
  rappel_jour_le: string | null;
};

export type Annonce = { tenantId: string; responsable: string; actionId: number; confieePar: string | null; libelles: string[]; ids: number[] };
export type Rappel = { id: number; actionId: number; libelle: string; jalon: "veille" | "jour" };
export type RappelsDUnePersonne = { tenantId: string; responsable: string; rappels: Rappel[] };

const LONGUEUR_MAX = 200;
export const HEURE_DES_RAPPELS = 9;

const estOuverte = (t: TacheANotifier) => t.statut !== "Terminé" && !!t.responsable;
const tronquer = (texte: string) => (texte.length > LONGUEUR_MAX ? `${texte.slice(0, LONGUEUR_MAX - 1)}…` : texte);

/** « AAAA-MM-JJ » du lendemain. */
export function lendemain(jour: string): string {
  const date = new Date(`${jour}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Les tâches confiées pas encore annoncées, une annonce par personne et par action. */
export function annoncesAEnvoyer(taches: TacheANotifier[]): Annonce[] {
  const parCle = new Map<string, Annonce>();
  for (const t of taches.filter((t) => !t.confiee_notifiee && estOuverte(t))) {
    const cle = `${t.responsable}|${t.action_id}`;
    const annonce = parCle.get(cle) ?? { tenantId: t.tenant_id, responsable: t.responsable!, actionId: t.action_id, confieePar: t.confiee_par, libelles: [], ids: [] };
    annonce.libelles.push(t.libelle);
    annonce.ids.push(t.id);
    parCle.set(cle, annonce);
  }
  return [...parCle.values()];
}

/** « Andy vous a confié : Réserver la salle » ou « Andy vous a confié 3 tâches : … ». */
export function texteDeLAnnonce(prenomQuiConfie: string | null, titreAction: string | null, libelles: string[]): string {
  const qui = prenomQuiConfie?.trim() || "Le bureau";
  const quoi = libelles.length === 1 ? ` : ${libelles[0]}` : ` ${libelles.length} tâches : ${libelles.join(", ")}`;
  const ou = titreAction ? ` (${titreAction})` : "";
  return tronquer(`${qui} vous a confié${quoi}${ou}`);
}

/**
 * Les rappels du jour : la veille de l'échéance, puis le jour même, chacun une fois. Une tâche
 * pas encore annoncée attend son annonce (sinon la personne recevrait deux messages d'un coup).
 */
export function rappelsAEnvoyer(taches: TacheANotifier[], aujourdhui: string): RappelsDUnePersonne[] {
  const demain = lendemain(aujourdhui);
  const parPersonne = new Map<string, RappelsDUnePersonne>();
  for (const t of taches.filter((t) => estOuverte(t) && t.confiee_notifiee)) {
    const jalon = t.echeance === aujourdhui && !t.rappel_jour_le ? "jour"
      : t.echeance === demain && !t.rappel_veille_le ? "veille" : null;
    if (!jalon) continue;
    const personne = parPersonne.get(t.responsable!) ?? { tenantId: t.tenant_id, responsable: t.responsable!, rappels: [] };
    personne.rappels.push({ id: t.id, actionId: t.action_id, libelle: t.libelle, jalon });
    parPersonne.set(t.responsable!, personne);
  }
  return [...parPersonne.values()];
}

/** « Aujourd'hui : Réserver la salle · Demain : Envoyer l'invitation ». */
export function texteDuRappel(rappels: Rappel[]): string {
  const liste = (jalon: Rappel["jalon"]) => rappels.filter((r) => r.jalon === jalon).map((r) => r.libelle);
  const parties = [["Aujourd'hui", liste("jour")], ["Demain", liste("veille")]] as const;
  return tronquer(parties.filter(([, l]) => l.length).map(([quand, l]) => `${quand} : ${l.join(", ")}`).join(" · "));
}

/** L'action à ouvrir au toucher : la seule concernée, sinon 0 (la liste des tâches du bureau). */
export function actionAOuvrir(rappels: { actionId: number }[]): number {
  const actions = new Set(rappels.map((r) => r.actionId));
  return actions.size === 1 ? [...actions][0] : 0;
}
