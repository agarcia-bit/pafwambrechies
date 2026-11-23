import { describe, expect, it } from "vitest";

import { placesSansRemplacant, texteDeLaReprise, texteSansRemplacant, type InscriptionRemplacee } from "./remplacements";

const inscription = (id: number, extra: Partial<InscriptionRemplacee> = {}): InscriptionRemplacee => ({
  id, tenant_id: "t", debut: "10:00:00", membre: "julien", annulee_le: null, annulation_notifiee: true, rappel_veille_le: null,
  remplacant_recherche_le: "2026-12-01T10:00:00Z", reprise_par: null, reprise_notifiee: true, sans_remplacant_signale_le: null,
  poles: { nom: "Gaufres", actions: { id: 7, titre: "Marché de Noël", date_action: "2026-12-12", referent: "andy", creneau_duree_minutes: 120 } },
  ...extra,
});

describe("remplacement d'un créneau : notifications", () => {
  it("dit à la personne remplacée qui reprend sa place", () => {
    expect(texteDeLaReprise("Léa", inscription(1))).toBe("Léa reprend votre place à « Marché de Noël » (Gaufres, 10 h – 12 h). Vous êtes libéré, merci !");
  });

  it("signale au référent, la veille, les places encore à reprendre, une fois par action", () => {
    const groupes = placesSansRemplacant([
      inscription(1),
      inscription(2, { membre: "zoe", debut: "12:00:00" }),
      inscription(3, { remplacant_recherche_le: null }), // ne cherche pas
      inscription(4, { sans_remplacant_signale_le: "2026-12-11T08:00:00Z" }), // déjà signalée
      inscription(5, { poles: { nom: "Café", actions: { id: 8, titre: "Loto", date_action: "2026-12-20", referent: "andy", creneau_duree_minutes: 60 } } }),
    ], "2026-12-12");
    expect(groupes.map((g) => g.ids)).toEqual([[1, 2]]);
    expect(texteSansRemplacant(groupes[0], new Map([["julien", "Julien"]])))
      .toBe("Pas encore de remplaçant pour « Marché de Noël » demain : Julien (Gaufres, 10 h – 12 h), un membre (Gaufres, 12 h – 14 h).");
  });
});
