// Le texte de l'e-mail envoyé au propriétaire de la plateforme pour un retour (bug ou idée), sans
// accès à la base ni au réseau : testé à part (message.test.ts), utilisé par index.ts.

export type RetourAEnvoyer = {
  id: number;
  type: "bug" | "idee";
  texte: string;
  auteur: string;      // « Prénom Nom », ou l'e-mail à défaut
  emailAuteur: string | null;
  association: string;
  appareil: Record<string, unknown>;
  lienCapture: string | null;
};

const LIBELLES = { bug: "Bug", idee: "Idée" } as const;
const PREMIERE_LIGNE_MAX = 60;

const echapperHtml = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** « [Bug] PAF Wambrechies : L'écran reste blanc quand… » */
export function sujetDuRetour(retour: RetourAEnvoyer): string {
  const premiereLigne = retour.texte.trim().split("\n")[0];
  const debut = premiereLigne.length > PREMIERE_LIGNE_MAX ? `${premiereLigne.slice(0, PREMIERE_LIGNE_MAX - 1)}…` : premiereLigne;
  return `[${LIBELLES[retour.type]}] ${retour.association} : ${debut}`;
}

/** « iOS 18.1 · app 1.0.0 · 390×844 » : ce que l'app ou le navigateur a joint. */
export function resumeDeLAppareil(appareil: Record<string, unknown>): string {
  return ["support", "systeme", "version", "ecran"]
    .map((cle) => appareil[cle])
    .filter((valeur) => typeof valeur === "string" && valeur.trim())
    .join(" · ") || "appareil inconnu";
}

/** Le corps de l'e-mail, en texte et en HTML. */
export function corpsDuRetour(retour: RetourAEnvoyer): { texte: string; html: string } {
  const qui = retour.emailAuteur ? `${retour.auteur} <${retour.emailAuteur}>` : retour.auteur;
  const lignes = [
    `${LIBELLES[retour.type]} n° ${retour.id} — ${retour.association}`,
    `De : ${qui}`,
    `Appareil : ${resumeDeLAppareil(retour.appareil)}`,
    "",
    retour.texte.trim(),
    ...(retour.lienCapture ? ["", `Capture (lien valable 30 jours) : ${retour.lienCapture}`] : []),
  ];
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">` +
    lignes.slice(0, 3).map((l) => `<p style="margin:0;color:#6b7280;font-size:13px">${echapperHtml(l)}</p>`).join("") +
    `<p style="margin-top:16px">${echapperHtml(retour.texte.trim()).replace(/\n/g, "<br>")}</p>` +
    (retour.lienCapture ? `<p><a href="${echapperHtml(retour.lienCapture)}"><img src="${echapperHtml(retour.lienCapture)}" alt="Capture" style="max-width:100%;border-radius:8px"></a></p>` : "") +
    `</div>`;
  return { texte: lignes.join("\n"), html };
}
