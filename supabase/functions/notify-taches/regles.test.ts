import { describe, expect, it } from "vitest";

import { actionAOuvrir, annoncesAEnvoyer, lendemain, rappelsAEnvoyer, texteDeLAnnonce, texteDuRappel, veille, type TacheANotifier } from "./regles";

const tache = (id: number, extra: Partial<TacheANotifier> = {}): TacheANotifier => ({
  id, tenant_id: "t", action_id: 1, libelle: `Tâche ${id}`, responsable: "anne", echeance: null, statut: "À faire",
  confiee_par: "andy", confiee_notifiee: true, rappel_veille_le: null, rappel_jour_le: null, ...extra,
});

describe("annoncesAEnvoyer", () => {
  it("regroupe par personne et par action, et ignore les tâches terminées ou déjà annoncées", () => {
    const annonces = annoncesAEnvoyer([
      tache(1, { confiee_notifiee: false }),
      tache(2, { confiee_notifiee: false }),
      tache(3, { confiee_notifiee: false, action_id: 2 }),
      tache(4, { confiee_notifiee: false, statut: "Terminé" }),
      tache(5),
    ]);
    expect(annonces.map((a) => [a.actionId, a.ids])).toEqual([[1, [1, 2]], [2, [3]]]);
  });
});

describe("texteDeLAnnonce", () => {
  it("nomme qui confie, la tâche ou leur nombre, et l'action", () => {
    expect(texteDeLAnnonce("Andy", "Matinale", ["Réserver la salle"])).toBe("Andy vous a confié : Réserver la salle (Matinale)");
    expect(texteDeLAnnonce(null, null, ["A", "B"])).toBe("Le bureau vous a confié 2 tâches : A, B");
  });
});

describe("rappelsAEnvoyer", () => {
  it("rappelle la veille puis le jour même, une fois chacun, après l'annonce", () => {
    const rappels = rappelsAEnvoyer([
      tache(1, { echeance: "2026-11-18" }),
      tache(2, { echeance: "2026-11-17" }),
      tache(3, { echeance: "2026-11-17", rappel_jour_le: "2026-11-17T08:00:00Z" }),
      tache(4, { echeance: "2026-11-18", confiee_notifiee: false }),
      tache(5, { echeance: "2026-11-19" }),
      tache(6, { echeance: "2026-11-17", statut: "Terminé" }),
    ], "2026-11-17");
    expect(rappels).toHaveLength(1);
    expect(rappels[0].rappels.map((r) => [r.id, r.jalon])).toEqual([[1, "veille"], [2, "jour"]]);
    expect(texteDuRappel(rappels[0].rappels)).toBe("Aujourd'hui : Tâche 2 · Demain : Tâche 1");
  });

  it("passe d'un mois à l'autre", () => {
    expect(lendemain("2026-11-30")).toBe("2026-12-01");
  });

  it("revient au jour d'avant, d'un mois et d'une année à l'autre", () => {
    expect(veille("2026-03-01")).toBe("2026-02-28");
    expect(veille("2027-01-01")).toBe("2026-12-31");
  });
});

describe("actionAOuvrir", () => {
  it("ouvre l'action quand elle est la seule, sinon la liste", () => {
    expect(actionAOuvrir([{ actionId: 4 }, { actionId: 4 }])).toBe(4);
    expect(actionAOuvrir([{ actionId: 4 }, { actionId: 5 }])).toBe(0);
  });
});
