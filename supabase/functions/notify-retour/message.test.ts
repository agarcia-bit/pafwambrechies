import { describe, expect, it } from "vitest";

import { corpsDuRetour, resumeDeLAppareil, sujetDuRetour, type RetourAEnvoyer } from "./message";

const retour = (extra: Partial<RetourAEnvoyer> = {}): RetourAEnvoyer => ({
  id: 12, type: "bug", texte: "L'écran reste blanc\nquand j'ouvre l'agenda", auteur: "Marie Dupont", emailAuteur: "marie@exemple.fr",
  association: "PAF Wambrechies", appareil: { support: "app", systeme: "iOS 18.1", version: "1.0.0", ecran: "390×844" }, lienCapture: null, ...extra,
});

describe("message d'un retour", () => {
  it("le sujet donne le type, l'association et la première ligne, raccourcie", () => {
    expect(sujetDuRetour(retour())).toBe("[Bug] PAF Wambrechies : L'écran reste blanc");
    expect(sujetDuRetour(retour({ type: "idee", texte: "x".repeat(80) }))).toBe(`[Idée] PAF Wambrechies : ${"x".repeat(59)}…`);
  });

  it("résume l'appareil, et le dit quand rien n'a été joint", () => {
    expect(resumeDeLAppareil(retour().appareil)).toBe("app · iOS 18.1 · 1.0.0 · 390×844");
    expect(resumeDeLAppareil({})).toBe("appareil inconnu");
  });

  it("le corps échappe le HTML et montre la capture quand il y en a une", () => {
    const { texte, html } = corpsDuRetour(retour({ texte: "<b>gras</b>", lienCapture: "https://x/capture.jpg" }));
    expect(texte).toContain("De : Marie Dupont <marie@exemple.fr>");
    expect(texte).toContain("Capture (lien valable 30 jours) : https://x/capture.jpg");
    expect(html).toContain("&lt;b&gt;gras&lt;/b&gt;");
    expect(html).toContain('<img src="https://x/capture.jpg"');
  });
});
