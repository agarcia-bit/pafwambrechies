import { describe, expect, it, vi } from "vitest";

// expediteur.ts lit un réglage du serveur (Deno.env) dès son chargement : on le simule, puis on
// charge le fichier ensuite.
vi.stubGlobal("Deno", { env: { get: () => undefined } });
const { htmlDuTexte } = await import("./expediteur");

describe("e-mail en HTML", () => {
  it("rend les adresses web cliquables et garde le texte protégé", () => {
    const html = htmlDuTexte("Android : https://play.google.com/store/apps/details?id=fr.agalumy.allianceo\n<b>");
    expect(html).toContain('<a href="https://play.google.com/store/apps/details?id=fr.agalumy.allianceo" style="color:#3730a3">');
    expect(html).toContain("&lt;b&gt;");
  });
});
