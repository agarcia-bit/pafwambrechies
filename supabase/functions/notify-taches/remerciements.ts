// Le remerciement du lendemain de l'action (supabase/presences_benevoles.sql), sans accès à la base
// ni au réseau : testé à part (remerciements.test.ts), appliqué par index.ts.
// Chaque bénévole venu reçoit un merci avec le bilan de la journée ; un absent pointé n'en reçoit
// pas, et ne compte pas dans le bilan. Une action déjà remerciée ne l'est plus.

export type InscriptionTenue = {
  tenant_id: string;
  membre: string | null;
  presence: "venu" | "absent" | null;
  poles: { actions: { id: number; titre: string; date_action: string; remerciement_envoye_le: string | null } };
};

export type Remerciement = { tenantId: string; actionId: number; titre: string; tenus: number; membres: string[] };

/** Les actions d'hier à remercier : combien de créneaux ont été tenus, et qui remercier. */
export function remerciementsAEnvoyer(inscriptions: InscriptionTenue[], hier: string): Remerciement[] {
  const parAction = new Map<number, Remerciement>();
  for (const i of inscriptions) {
    const action = i.poles.actions;
    if (action.date_action !== hier || action.remerciement_envoye_le || i.presence === "absent") continue;
    const groupe = parAction.get(action.id) ?? { tenantId: i.tenant_id, actionId: action.id, titre: action.titre, tenus: 0, membres: [] };
    groupe.tenus += 1;
    if (i.membre && !groupe.membres.includes(i.membre)) groupe.membres.push(i.membre);
    parAction.set(action.id, groupe);
  }
  return [...parAction.values()];
}

/** « Merci pour votre aide à « Marché de Noël » ! Ensemble, 42 créneaux tenus. » */
export function texteDuRemerciement(r: Remerciement): string {
  const bilan = r.tenus > 1 ? `Ensemble, ${r.tenus} créneaux tenus.` : "Votre créneau a bien été tenu.";
  return `Merci pour votre aide à « ${r.titre} » ! ${bilan}`;
}
