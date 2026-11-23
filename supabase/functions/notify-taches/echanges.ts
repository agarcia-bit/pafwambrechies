// Les notifications de l'échange d'un créneau contre un autre (supabase/creneaux.sql, section 10),
// sans accès à la base ni au réseau : testées à part (echanges.test.ts), appliquées par index.ts.
//  * un échange est proposé : les adhérents inscrits sur le créneau visé sont prévenus, sans savoir
//    qui propose ;
//  * il est accepté : la personne qui proposait apprend son nouveau créneau.

import { libelleDeTranche } from "./creneaux.ts";

export type EchangeANotifier = {
  id: number;
  tenant_id: string;
  propose_par: string;
  pole_vise: number;
  debut_vise: string; // « HH:MM:SS »
  statut: "en_attente" | "accepte" | "annule";
  offerte: { debut: string; poles: { nom: string; actions: { id: number; titre: string; creneau_duree_minutes: number | null } } };
  vise: { nom: string };
};

const creneau = (pole: string, debut: string, duree: number | null) => `${pole}, ${libelleDeTranche(debut, duree ?? 60)}`;

/** « Quelqu'un propose d'échanger son créneau (Gaufres, 10 h – 12 h) contre le vôtre (Café, 14 h – 16 h) à « Marché de Noël ». » */
export function texteDeLaPropositionDEchange(e: EchangeANotifier): string {
  const action = e.offerte.poles.actions;
  return `Quelqu’un propose d’échanger son créneau (${creneau(e.offerte.poles.nom, e.offerte.debut, action.creneau_duree_minutes)}) `
    + `contre le vôtre (${creneau(e.vise.nom, e.debut_vise, action.creneau_duree_minutes)}) à « ${action.titre} ».`;
}

/** Après l'échange, l'inscription offerte porte le créneau visé : c'est le nouveau créneau de la personne. */
export function texteDeLEchangeAccepte(e: EchangeANotifier): string {
  const action = e.offerte.poles.actions;
  return `Échange accepté : vous êtes maintenant au créneau ${creneau(e.vise.nom, e.debut_vise, action.creneau_duree_minutes)} à « ${action.titre} ».`;
}
