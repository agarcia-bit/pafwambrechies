import { describe, expect, it } from "vitest";

import { remerciementsAEnvoyer, texteDuRemerciement, type InscriptionTenue } from "./remerciements";

const action = { id: 7, titre: "Marché de Noël", date_action: "2026-12-12", remerciement_envoye_le: null };
const inscription = (membre: string | null, presence: InscriptionTenue["presence"] = null, a = action): InscriptionTenue =>
  ({ tenant_id: "t", membre, presence, poles: { actions: a } });

describe("remerciement du lendemain", () => {
  it("remercie chaque bénévole une fois et compte les créneaux tenus, noms écrits à la main compris", () => {
    const [r] = remerciementsAEnvoyer([inscription("lea"), inscription("lea"), inscription(null), inscription("tom", "venu")], "2026-12-12");
    expect(r).toMatchObject({ actionId: 7, tenus: 4, membres: ["lea", "tom"] });
  });

  it("ne remercie pas un absent pointé, et ne le compte pas", () => {
    const [r] = remerciementsAEnvoyer([inscription("lea"), inscription("tom", "absent")], "2026-12-12");
    expect(r).toMatchObject({ tenus: 1, membres: ["lea"] });
  });

  it("laisse les actions d'un autre jour et celles déjà remerciées", () => {
    const dejaFaite = { ...action, id: 8, remerciement_envoye_le: "2026-12-13T09:00:00Z" };
    const autreJour = { ...action, id: 9, date_action: "2026-12-11" };
    expect(remerciementsAEnvoyer([inscription("lea", null, dejaFaite), inscription("lea", null, autreJour)], "2026-12-12")).toEqual([]);
  });

  it("donne le bilan de la journée", () => {
    const base = { tenantId: "t", actionId: 7, titre: "Marché de Noël", membres: [] };
    expect(texteDuRemerciement({ ...base, tenus: 42 })).toBe("Merci pour votre aide à « Marché de Noël » ! Ensemble, 42 créneaux tenus.");
    expect(texteDuRemerciement({ ...base, tenus: 1 })).toBe("Merci pour votre aide à « Marché de Noël » ! Votre créneau a bien été tenu.");
  });
});
