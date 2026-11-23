import { describe, expect, it } from "vitest";

import { desistementsAPrevenir, libelleDeTranche, rappelsDeLaVeille, texteDuDesistement, texteDuRappelDeLaVeille, type InscriptionANotifier } from "./creneaux";

const inscription = (id: number, extra: Partial<InscriptionANotifier> = {}): InscriptionANotifier => ({
  id, tenant_id: "t", debut: "10:00:00", membre: "lea", annulee_le: null, annulation_notifiee: true, rappel_veille_le: null,
  poles: { nom: "Gaufres", actions: { id: 7, titre: "Marché de Noël", date_action: "2026-12-12", referent: "andy", creneau_duree_minutes: 120 } },
  ...extra,
});

describe("créneaux : notifications", () => {
  it("écrit une tranche comme on la dit", () => {
    expect(libelleDeTranche("09:30:00", 90)).toBe("9 h 30 – 11 h");
  });

  it("prévient le référent d'une désinscription, mais pas quand c'est lui qui se désinscrit", () => {
    const annulee = { annulee_le: "2026-12-01T10:00:00Z", annulation_notifiee: false };
    const desistements = desistementsAPrevenir([inscription(1, annulee), inscription(2, { ...annulee, membre: "andy" }), inscription(3)]);
    expect(desistements).toEqual([{ tenantId: "t", referent: "andy", actionId: 7, membre: "lea", texteDuCreneau: "Gaufres, 10 h – 12 h" }]);
    expect(texteDuDesistement("Léa", "Marché de Noël", "Gaufres, 10 h – 12 h"))
      .toBe("Léa ne peut plus venir à « Marché de Noël » (Gaufres, 10 h – 12 h). La place est de nouveau libre.");
  });

  it("rappelle la veille, une fois par personne et par action, sans les noms écrits à la main", () => {
    const rappels = rappelsDeLaVeille([
      inscription(1),
      inscription(2, { debut: "14:00:00" }),
      inscription(3, { membre: null }),
      inscription(4, { rappel_veille_le: "2026-12-11T09:00:00Z" }),
      inscription(5, { annulee_le: "2026-12-10T09:00:00Z" }),
    ], "2026-12-12");
    expect(rappels).toHaveLength(1);
    expect(rappels[0].ids).toEqual([1, 2]);
    expect(texteDuRappelDeLaVeille(rappels[0])).toBe("Demain, « Marché de Noël » : Gaufres, 10 h – 12 h · Gaufres, 14 h – 16 h. Merci pour votre aide !");
  });
});
