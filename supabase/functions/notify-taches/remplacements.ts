// Les notifications du remplacement d'un créneau (supabase/creneaux.sql, section 9), sans accès à
// la base ni au réseau : testées à part (remplacements.test.ts), appliquées par index.ts.
//  * quelqu'un reprend la place : la personne remplacée est prévenue qu'elle est libérée ;
//  * la veille de l'action, à partir de 9 h : le référent apprend quelles places n'ont pas trouvé
//    de remplaçant (un message par action).

import { creneauDe, type InscriptionANotifier } from "./creneaux.ts";

export type InscriptionRemplacee = InscriptionANotifier & {
  remplacant_recherche_le: string | null;
  reprise_par: string | null;
  reprise_notifiee: boolean;
  sans_remplacant_signale_le: string | null;
};

export type SansRemplacant = { tenantId: string; referent: string; actionId: number; titre: string; places: { membre: string | null; creneau: string }[]; ids: number[] };

/** « Léa reprend votre place à « Marché de Noël » (Gaufres, 10 h – 12 h). Vous êtes libéré, merci ! » */
export function texteDeLaReprise(prenomQuiReprend: string | null, inscription: InscriptionANotifier): string {
  return `${prenomQuiReprend?.trim() || "Un membre"} reprend votre place à « ${inscription.poles.actions.titre} » (${creneauDe(inscription)}). Vous êtes libéré, merci !`;
}

/** Les places encore à reprendre la veille de l'action, regroupées par action ; rien quand il n'y a pas de référent. */
export function placesSansRemplacant(inscriptions: InscriptionRemplacee[], demain: string): SansRemplacant[] {
  const parAction = new Map<number, SansRemplacant>();
  for (const i of inscriptions) {
    const action = i.poles.actions;
    if (!i.remplacant_recherche_le || i.annulee_le || i.sans_remplacant_signale_le || action.date_action !== demain || !action.referent) continue;
    const groupe = parAction.get(action.id) ?? { tenantId: i.tenant_id, referent: action.referent, actionId: action.id, titre: action.titre, places: [], ids: [] };
    groupe.places.push({ membre: i.membre, creneau: creneauDe(i) });
    groupe.ids.push(i.id);
    parAction.set(action.id, groupe);
  }
  return [...parAction.values()];
}

/** « Pas encore de remplaçant pour « Marché de Noël » demain : Julien (Gaufres, 10 h – 12 h). » */
export function texteSansRemplacant(groupe: SansRemplacant, prenoms: Map<string, string | null>): string {
  const places = groupe.places.map((p) => `${(p.membre && prenoms.get(p.membre)) || "un membre"} (${p.creneau})`).join(", ");
  return `Pas encore de remplaçant pour « ${groupe.titre} » demain : ${places}.`;
}
