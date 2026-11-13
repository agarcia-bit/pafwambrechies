// Reçoit les avis de Resend (webhook) et note l'ouverture d'un e-mail du bureau :
// envoi_destinataires.ouvert_le, retrouvé par la référence gardée à l'envoi (send-mail).
// Resend signe chaque avis (format Svix) avec le secret RESEND_WEBHOOK_SECRET (« whsec_… »),
// copié par l'administrateur dans les secrets des fonctions : un avis non signé est refusé.
// Déployée sans vérification de jeton (verify_jwt = false) : Resend n'en envoie pas, la
// signature en tient lieu.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const TOLERANCE_SECONDES = 5 * 60;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function base64VersOctets(texte: string): Uint8Array {
  return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));
}

/** Vérifie la signature Svix : HMAC-SHA256 de « id.horodatage.corps » avec le secret. */
async function signatureValide(req: Request, corps: string): Promise<boolean> {
  const id = req.headers.get("svix-id");
  const horodatage = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!SECRET || !id || !horodatage || !signatures) return false;
  // Un avis trop ancien ou venu du futur est refusé : il pourrait être rejoué.
  if (Math.abs(Date.now() / 1000 - Number(horodatage)) > TOLERANCE_SECONDES) return false;
  const cle = await crypto.subtle.importKey(
    "raw", base64VersOctets(SECRET.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signe = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${id}.${horodatage}.${corps}`));
  const attendue = btoa(String.fromCharCode(...new Uint8Array(signe)));
  return signatures.split(" ").some((s) => s.split(",")[1] === attendue);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const corps = await req.text();
  if (!(await signatureValide(req, corps))) return new Response("Signature invalide", { status: 401 });

  const avis = JSON.parse(corps) as { type?: string; created_at?: string; data?: { email_id?: string } };
  if (avis.type !== "email.opened" || !avis.data?.email_id) return Response.json({ ignore: avis.type });

  // Seule la première ouverture compte : les suivantes ne changent pas la date.
  const { error } = await sb.from("envoi_destinataires")
    .update({ ouvert_le: avis.created_at ?? new Date().toISOString() })
    .eq("resend_id", avis.data.email_id)
    .is("ouvert_le", null);
  if (error) {
    console.error("[resend-webhook]", error);
    return new Response("Erreur", { status: 500 });
  }
  return Response.json({ ok: true });
});
