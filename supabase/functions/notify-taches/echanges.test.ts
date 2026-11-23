import { describe, expect, it } from "vitest";

import { texteDeLaPropositionDEchange, texteDeLEchangeAccepte, type EchangeANotifier } from "./echanges";

const echange: EchangeANotifier = {
  id: 1, tenant_id: "t", propose_par: "julien", pole_vise: 2, debut_vise: "14:00:00", statut: "en_attente",
  offerte: { debut: "10:00:00", poles: { nom: "Gaufres", actions: { id: 7, titre: "Marché de Noël", creneau_duree_minutes: 120 } } },
  vise: { nom: "Café" },
};

describe("échange de créneaux : notifications", () => {
  it("prévient les personnes visées sans nommer celle qui propose", () => {
    expect(texteDeLaPropositionDEchange(echange))
      .toBe("Quelqu’un propose d’échanger son créneau (Gaufres, 10 h – 12 h) contre le vôtre (Café, 14 h – 16 h) à « Marché de Noël ».");
  });

  it("donne son nouveau créneau à la personne qui proposait", () => {
    expect(texteDeLEchangeAccepte({ ...echange, statut: "accepte" }))
      .toBe("Échange accepté : vous êtes maintenant au créneau Café, 14 h – 16 h à « Marché de Noël ».");
  });
});
