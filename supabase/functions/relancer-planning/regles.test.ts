import { describe, expect, it } from "vitest";

import { destinatairesDeLaRelance, sujetDeLaRelance, texteDeLaNotification, texteDeLEmail } from "./regles";

describe("relance d'un planning", () => {
  const membres = [
    { id: "andy", email: "andy@exemple.fr" },
    { id: "lea", email: "lea@exemple.fr" },
    { id: "tom", email: "Tom@Exemple.fr" },
    { id: "zoe", email: null },
    { id: "max", email: "max@exemple.fr" },
  ];
  const appareils = [{ id: 1, user_id: "lea", token: "t1" }, { id: 2, user_id: "lea", token: "t2" }];

  it("prévient les non-inscrits : notification s'ils ont l'app, sinon e-mail, jamais celui qui relance", () => {
    const d = destinatairesDeLaRelance(membres, ["invite@exemple.fr", "tom@exemple.fr", "pas-un-email"], new Set(["max"]), appareils, "andy");
    expect(d.parNotification).toEqual([{ userId: "lea", appareils }]);
    // Tom une seule fois (son e-mail revient aussi dans les invités), Zoé sans e-mail est ignorée.
    expect(d.parEmail).toEqual(["tom@exemple.fr", "invite@exemple.fr"]);
  });

  it("écrit l'objet, l'e-mail et une notification courte", () => {
    expect(sujetDeLaRelance("Marché de Noël")).toBe("Marché de Noël : on a besoin de vous");
    expect(texteDeLEmail("Il manque 8 personnes.")).toContain("onglet Agenda");
    expect(texteDeLaNotification("a ".repeat(200))).toHaveLength(180);
  });
});
