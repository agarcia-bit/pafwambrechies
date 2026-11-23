import { describe, expect, it } from "vitest";

import { bureauAPrevenir, reponseALAuteur, texteDeLaProposition, type PropositionANotifier } from "./propositions";

const karaoke: PropositionANotifier = {
  id: 1, tenant_id: "paf", auteur: "julien", type: "personnel", titre: "Soirée karaoké", statut: "en_attente",
  devenue: null, evenement_id: null, mot_du_bureau: null, repetition: "mois",
};

describe("notifications des propositions d'événements", () => {
  it("prévient le bureau de l'association, sauf l'auteur s'il en fait partie", () => {
    const bureau = [{ id: "andy", tenant_id: "paf" }, { id: "julien", tenant_id: "paf" }, { id: "eve", tenant_id: "autre" }];
    expect(bureauAPrevenir(karaoke, bureau)).toEqual(["andy"]);
    expect(texteDeLaProposition("Julien", karaoke)).toBe("Julien propose de faire connaître son événement : « Soirée karaoké ». À voir dans le Pilotage.");
    expect(texteDeLaProposition(null, { ...karaoke, type: "a_organiser" })).toContain("Un membre propose un événement à organiser");
  });

  it("dit à l'auteur que son événement est publié, et la notification ouvre l'événement", () => {
    expect(reponseALAuteur({ ...karaoke, statut: "acceptee", devenue: "evenement", evenement_id: 42 })).toEqual({
      texte: "Bonne nouvelle : « Soirée karaoké » est publié dans l’Agenda avec toutes ses séances.",
      donnees: { evenement_id: 42 },
    });
    expect(reponseALAuteur({ ...karaoke, type: "a_organiser", statut: "acceptee", devenue: "action" }).texte).toContain("va l’organiser");
  });

  it("transmet le mot du bureau quand la proposition n'est pas retenue", () => {
    expect(reponseALAuteur({ ...karaoke, statut: "refusee", mot_du_bureau: " La salle n'est pas libre. " }).texte)
      .toBe("« Soirée karaoké » n’est pas retenu pour le moment. Le mot du bureau : La salle n'est pas libre.");
    expect(reponseALAuteur({ ...karaoke, statut: "refusee" }).texte).toBe("« Soirée karaoké » n’est pas retenu pour le moment.");
  });
});
