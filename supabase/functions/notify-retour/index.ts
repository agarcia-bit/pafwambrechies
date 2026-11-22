// Envoie au propriétaire de la plateforme l'e-mail d'un nouveau retour (bug ou idée). Appelée par
// le déclencheur de supabase/retours.sql avec la clé de service et { id } ; une réponse à l'e-mail
// part directement à l'auteur du retour.
//
// Secrets : RESEND_API_KEY et MAIL_DOMAIN (les mêmes que send-mail) ; RETOURS_EMAIL, facultatif,
// change l'adresse qui reçoit (par défaut celle affichée sur monallianceo.fr).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corpsDuRetour, sujetDuRetour, type RetourAEnvoyer } from "./message.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_DOMAIN = Deno.env.get("MAIL_DOMAIN")?.trim().toLowerCase();
const DESTINATAIRE = Deno.env.get("RETOURS_EMAIL")?.trim() || "contact@agalumy.fr";
const DUREE_DU_LIEN = 30 * 24 * 3600; // secondes

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// verify_jwt ne vérifie que la signature : la clé publique anon passerait aussi.
function estLaCleDeService(req: Request): boolean {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "") ?? "";
  try {
    const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

/** Le retour et ce qu'il faut pour l'e-mail : auteur, association, lien vers la capture. */
async function chargerLeRetour(id: number): Promise<RetourAEnvoyer | null> {
  const { data: retour } = await sb.from("retours").select("id, type, texte, capture, appareil, auteur, tenant_id").eq("id", id).maybeSingle();
  if (!retour) return null;
  const [{ data: profil }, { data: marque }, capture] = await Promise.all([
    sb.from("profiles").select("prenom, nom, email").eq("id", retour.auteur).maybeSingle(),
    sb.rpc("branding_for_tenant", { p_tenant: retour.tenant_id }),
    retour.capture ? sb.storage.from("retours-captures").createSignedUrl(retour.capture, DUREE_DU_LIEN) : Promise.resolve(null),
  ]);
  const nom = [profil?.prenom, profil?.nom].filter(Boolean).join(" ").trim();
  return {
    id: retour.id,
    type: retour.type,
    texte: retour.texte,
    auteur: nom || profil?.email || "Un membre",
    emailAuteur: profil?.email ?? null,
    association: (marque?.tenant_name || marque?.name || "Association inconnue").trim(),
    appareil: retour.appareil ?? {},
    lienCapture: capture?.data?.signedUrl ?? null,
  };
}

Deno.serve(async (req) => {
  if (!estLaCleDeService(req)) return new Response("Réservé au serveur", { status: 401 });
  if (!RESEND_API_KEY) return Response.json({ error: "not_configured" }, { status: 501 });
  const { id } = await req.json().catch(() => ({ id: null }));
  const retour = typeof id === "number" ? await chargerLeRetour(id) : null;
  if (!retour) return Response.json({ error: "introuvable" }, { status: 404 });

  const { texte, html } = corpsDuRetour(retour);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `"Allianceo" <${MAIL_DOMAIN ? `retours@${MAIL_DOMAIN}` : "onboarding@resend.dev"}>`,
      to: [DESTINATAIRE],
      ...(retour.emailAuteur ? { reply_to: retour.emailAuteur } : {}),
      subject: sujetDuRetour(retour),
      text: texte,
      html,
    }),
  });
  if (!res.ok) {
    console.error("[notify-retour] Resend", res.status, await res.text());
    return Response.json({ error: "envoi" }, { status: 502 });
  }
  return Response.json({ ok: true });
});
