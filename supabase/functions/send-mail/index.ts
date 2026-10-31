// Sends an e-mail from the bureau to members (bureau web dashboard) and records it in
// public.envois / envoi_destinataires (supabase/envois.sql). Called with the member's JWT:
// the caller must be bureau or admin of their association. Provider: Resend, one message
// per recipient (nobody sees the other addresses), "reply-to" set to the sender.
//
// Sender: each association sends under its own name and address on the platform domain,
// e.g. "PAF Wambrechies <paf-wambrechies@monallianceo.fr>" (no mailbox needed: replies go to
// the bureau member through reply-to).
//
// Secrets: RESEND_API_KEY (required), MAIL_DOMAIN (a domain verified in Resend, e.g.
// "monallianceo.fr"). Without MAIL_DOMAIN, Resend's test address is used (it only delivers to
// the Resend account owner). Without RESEND_API_KEY the function answers 501 and the
// dashboard falls back to a mailto: link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_DOMAIN = Deno.env.get("MAIL_DOMAIN")?.trim().toLowerCase();

/** "PAF Wambrechies" <paf-wambrechies@monallianceo.fr> */
function senderFor(name: string, slug: string): string {
  const display = name.replace(/["<>\r\n]/g, "").trim() || "Allianceo";
  const local = slug.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "association";
  return `"${display}" <${MAIL_DOMAIN ? `${local}@${MAIL_DOMAIN}` : "onboarding@resend.dev"}>`;
}
const MAX_RECIPIENTS = 300;
const BATCH = 100; // Resend batch endpoint limit

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Recipient = { email: string; user_id?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!RESEND_API_KEY) return json({ error: "not_configured" }, 501);

  // Who is calling: a client bound to the caller's JWT, so RLS and auth.uid() apply.
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await asUser.from("profiles").select("prenom, nom, email, role, tenant_id").eq("id", user.id).single();
  if (!profile || !["bureau", "admin"].includes(profile.role)) return json({ error: "forbidden" }, 403);

  let body: { destinataires?: Recipient[]; sujet?: string; corps?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const sujet = (body.sujet ?? "").trim();
  const corps = (body.corps ?? "").trim();
  const seen = new Set<string>();
  const to = (body.destinataires ?? [])
    .map((r) => ({ email: (r.email ?? "").trim().toLowerCase(), user_id: r.user_id ?? null }))
    .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email) && !seen.has(r.email) && seen.add(r.email));
  if (!sujet || !corps || !to.length) return json({ error: "missing_fields" }, 400);
  if (to.length > MAX_RECIPIENTS) return json({ error: "too_many" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tenant } = await sb.from("tenants").select("name, slug").eq("id", profile.tenant_id).single();
  const { data: branding } = await sb.from("app_settings").select("value")
    .eq("tenant_id", profile.tenant_id).eq("key", "tenant_name").maybeSingle();
  const sender = [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email || "Le bureau";
  // The name the association chose in its settings, else the platform's record.
  const assoc = branding?.value?.trim() || tenant?.name || "Votre association";
  const from = senderFor(assoc, tenant?.slug ?? "");
  const text = `${corps}\n\n—\n${sender}, pour ${assoc}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">` +
    `<p>${escapeHtml(corps).replace(/\n/g, "<br>")}</p>` +
    `<p style="color:#6b7280;font-size:13px;margin-top:24px">— ${escapeHtml(sender)}, pour ${escapeHtml(assoc)}</p></div>`;

  const failed = new Set<string>();
  for (let i = 0; i < to.length; i += BATCH) {
    const batch = to.slice(i, i + BATCH);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((r) => ({
          from,
          to: [r.email],
          reply_to: profile.email ?? undefined,
          subject: sujet,
          text,
          html,
        }))),
      });
      if (!res.ok) {
        console.error("Resend error", res.status, await res.text());
        batch.forEach((r) => failed.add(r.email));
      }
    } catch (err) {
      console.error("Resend error", err);
      batch.forEach((r) => failed.add(r.email));
    }
  }

  // History (best effort: a logging problem must not hide a sent e-mail).
  const { data: envoi } = await sb.from("envois")
    .insert({ tenant_id: profile.tenant_id, envoye_par: user.id, sujet, corps, nb: to.length - failed.size })
    .select("id").single();
  if (envoi) {
    await sb.from("envoi_destinataires").insert(to.map((r) => ({
      envoi_id: envoi.id, tenant_id: profile.tenant_id, email: r.email, user_id: r.user_id,
      statut: failed.has(r.email) ? "echec" : "envoye",
    })));
  }

  return json({ sent: to.length - failed.size, failed: failed.size });
});
