// Les notifications des événements proposés par les membres (supabase/propositions_evenements.sql),
// sans accès à la base ni au réseau : testées à part (propositions.test.ts), appliquées par index.ts.
//  * une proposition arrive : chaque membre du bureau est prévenu, sauf son auteur ;
//  * le bureau répond : l'auteur apprend si son événement est publié, retenu ou pas, avec le mot
//    du bureau s'il y en a un.

export type PropositionANotifier = {
  id: number;
  tenant_id: string;
  auteur: string;
  type: "a_organiser" | "personnel";
  titre: string;
  statut: "en_attente" | "acceptee" | "refusee";
  devenue: "evenement" | "action" | null;
  evenement_id: number | null;
  mot_du_bureau: string | null;
  repetition: "aucune" | "semaine" | "mois";
};

export type MembreDuBureau = { id: string; tenant_id: string };

/** Les membres du bureau à prévenir d'une proposition : ceux de son association, sauf son auteur. */
export function bureauAPrevenir(proposition: PropositionANotifier, bureau: MembreDuBureau[]): string[] {
  return bureau.filter((m) => m.tenant_id === proposition.tenant_id && m.id !== proposition.auteur).map((m) => m.id);
}

/** « Julien propose un événement : « Soirée karaoké ». À voir dans le Pilotage. » */
export function texteDeLaProposition(prenom: string | null, proposition: PropositionANotifier): string {
  const qui = prenom?.trim() || "Un membre";
  const quoi = proposition.type === "personnel" ? "propose de faire connaître son événement" : "propose un événement à organiser";
  return `${qui} ${quoi} : « ${proposition.titre} ». À voir dans le Pilotage.`;
}

/** Ce que l'auteur apprend de la réponse du bureau, et où le mène la notification. */
export function reponseALAuteur(proposition: PropositionANotifier): { texte: string; donnees: Record<string, unknown> } {
  const titre = `« ${proposition.titre} »`;
  if (proposition.statut === "refusee") {
    const mot = proposition.mot_du_bureau?.trim();
    return { texte: `${titre} n’est pas retenu pour le moment.${mot ? ` Le mot du bureau : ${mot}` : ""}`, donnees: {} };
  }
  if (proposition.devenue === "action") {
    return { texte: `Bonne nouvelle : le bureau retient ${titre} et va l’organiser. Merci pour l’idée !`, donnees: {} };
  }
  const seances = proposition.repetition === "aucune" ? "" : " avec toutes ses séances";
  return {
    texte: `Bonne nouvelle : ${titre} est publié dans l’Agenda${seances}.`,
    donnees: proposition.evenement_id ? { evenement_id: proposition.evenement_id } : {},
  };
}
