// L'expéditeur et la mise en page des e-mails de l'association, comme ceux des messages du bureau
// (send-mail) : même nom, même adresse sur le domaine de la plateforme. Chaque fonction en ligne
// est déployée seule, d'où cette petite copie plutôt qu'un import depuis send-mail.
const MAIL_DOMAIN = Deno.env.get("MAIL_DOMAIN")?.trim().toLowerCase();

/** "PAF Wambrechies" <paf-wambrechies@monallianceo.fr> */
export function expediteurDe(nom: string, slug: string): string {
  const affiche = nom.replace(/["<>\r\n]/g, "").trim() || "Allianceo";
  const local = slug.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "association";
  return `"${affiche}" <${MAIL_DOMAIN ? `${local}@${MAIL_DOMAIN}` : "onboarding@resend.dev"}>`;
}

const echapper = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Le même texte en HTML simple, lisible dans toutes les messageries. */
// Les adresses web deviennent des liens cliquables (les liens vers les stores, par exemple).
const avecLiens = (html: string) => html.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#3730a3">${url}</a>`);

export const htmlDuTexte = (texte: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">` +
  `<p>${avecLiens(echapper(texte)).replace(/\n/g, "<br>")}</p></div>`;
