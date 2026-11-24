// Relance d'un planning de présences (bouton « Prévenir les membres » de la page Planning).
// Appelée avec le jeton du membre du bureau qui relance, elle :
//  1. vérifie qu'il est du bureau (ou administrateur) de l'association de l'action ;
//  2. ouvre le planning aux membres s'il était encore réservé au bureau ;
//  3. prévient les membres pas encore inscrits : notification Expo s'ils ont l'app, e-mail sinon
//     (Resend, au nom de l'association), ainsi que les adhérents invités sans compte ;
//  4. note la relance dans relances_planning (supabase/relances_planning.sql).
// Une notification touchée ouvre le planning dans l'app (data.planning_action).
// Secrets déjà en place : EXPO_ACCESS_TOKEN, RESEND_API_KEY, MAIL_DOMAIN.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { expediteurDe, htmlDuTexte } from "./expediteur.ts";
import { destinatairesDeLaRelance, destinatairesDeLEssai, marquerLEssai, sujetDeLaRelance, texteDeLaNotification, texteDeLEmail, type Appareil, type Destinataires } from "./regles.ts";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOT = 100; // limite d'Expo comme de Resend par appel
const MAX_EMAILS = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });

// apercu : ne rien envoyer, seulement dire combien de personnes seraient prévenues (fenêtre du bureau).
// essai : n'envoyer le message qu'à celui qui relance, sans ouvrir le planning ni noter de relance.
type Demande = { tenantId: string; moi: string; actionId: number; message: string; apercu: boolean; essai: boolean };
type Action = { id: number; tenant_id: string; titre: string; date_action: string; ouvert_aux_membres: boolean; creneau_debut: string | null };

/** Qui relance, et pour quelle action ; sinon la réponse d'erreur à renvoyer telle quelle. */
async function lireLaDemande(req: Request): Promise<Demande | Response> {
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return reponse({ error: "unauthorized" }, 401);
  const { data: profil } = await asUser.from("profiles").select("role, tenant_id").eq("id", user.id).single();
  if (!profil || !["bureau", "admin"].includes(profil.role)) return reponse({ error: "forbidden" }, 403);
  const corps = await req.json().catch(() => ({})) as { action_id?: number; message?: string; apercu?: boolean; essai?: boolean };
  const message = (corps.message ?? "").trim();
  const apercu = corps.apercu === true;
  if (!corps.action_id || (!apercu && !message) || message.length > 1000) return reponse({ error: "missing_fields" }, 400);
  return { tenantId: profil.tenant_id, moi: user.id, actionId: Number(corps.action_id), message, apercu, essai: corps.essai === true };
}

/** Les membres à prévenir : tous ceux de l'association, moins les inscrits et celui qui relance. */
async function chercherLesDestinataires(sb: SupabaseClient, d: Demande): Promise<Destinataires> {
  const [membres, invites, inscrits, appareils] = await Promise.all([
    sb.from("profiles").select("id, email").eq("tenant_id", d.tenantId),
    sb.from("adherents_invites").select("email").eq("tenant_id", d.tenantId).is("joined_at", null),
    sb.from("inscriptions_creneaux").select("membre, poles!inner(action_id)").eq("poles.action_id", d.actionId).is("annulee_le", null),
    sb.from("device_tokens").select("id, user_id, token").eq("tenant_id", d.tenantId),
  ]);
  const erreur = membres.error ?? invites.error ?? inscrits.error ?? appareils.error;
  if (erreur) throw erreur;
  const dejaInscrits = new Set((inscrits.data ?? []).map((i) => i.membre).filter(Boolean) as string[]);
  return destinatairesDeLaRelance(membres.data ?? [], (invites.data ?? []).map((i) => i.email), dejaInscrits, (appareils.data ?? []) as Appareil[], d.moi);
}

/** L'essai : seulement celui qui relance, avec son téléphone s'il en a un. */
async function chercherLeDestinataireDeLEssai(sb: SupabaseClient, d: Demande): Promise<Destinataires> {
  const [moi, appareils] = await Promise.all([
    sb.from("profiles").select("id, email").eq("id", d.moi).single(),
    sb.from("device_tokens").select("id, user_id, token").eq("user_id", d.moi),
  ]);
  if (appareils.error) throw appareils.error;
  return destinatairesDeLEssai(moi.data ?? null, (appareils.data ?? []) as Appareil[]);
}

/** Envoie la notification ; oublie les téléphones qui n'existent plus. Rend le nombre de personnes prévenues. */
async function envoyerLesNotifications(sb: SupabaseClient, d: Demande, titre: string, destinataires: Destinataires["parNotification"]): Promise<number> {
  const appareils = destinataires.flatMap((p) => p.appareils);
  const recus = new Set<string>();
  for (let i = 0; i < appareils.length; i += LOT) {
    const lot = appareils.slice(i, i + LOT);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}) },
        body: JSON.stringify(lot.map((a) => ({ to: a.token, title: marquerLEssai(titre, d.essai), body: texteDeLaNotification(d.message), sound: "default", channelId: "default", data: { planning_action: d.actionId } }))),
      });
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error(`HTTP ${res.status}`);
      lot.forEach((a, k) => { if (json.data[k]?.status === "ok") recus.add(a.user_id); });
      const disparus = lot.filter((_, k) => json.data[k]?.details?.error === "DeviceNotRegistered").map((a) => a.id);
      if (disparus.length) await sb.from("device_tokens").delete().in("id", disparus);
    } catch (err) {
      console.error("[relancer-planning] Expo", err);
    }
  }
  return recus.size;
}

/** Envoie l'e-mail au nom de l'association, un message par personne. Rend le nombre d'e-mails partis. */
async function envoyerLesEmails(sb: SupabaseClient, d: Demande, action: Action, emails: string[]): Promise<number> {
  if (!RESEND_API_KEY || !emails.length) return 0;
  const [{ data: association }, { data: reglages }] = await Promise.all([
    sb.from("tenants").select("name, slug").eq("id", d.tenantId).single(),
    sb.from("app_settings").select("key, value").eq("tenant_id", d.tenantId).in("key", ["tenant_name", "contact_email"]),
  ]);
  const reglage = (cle: string) => reglages?.find((r) => r.key === cle)?.value?.trim() ?? "";
  const nom = reglage("tenant_name") || association?.name || "Votre association";
  const contact = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reglage("contact_email")) ? reglage("contact_email") : null;
  const texte = `${texteDeLEmail(d.message)}\n\n—\n${contact ? nom : `${nom} · Merci de ne pas répondre directement à cet e-mail.`}`;
  let envoyes = 0;
  for (let i = 0; i < Math.min(emails.length, MAX_EMAILS); i += LOT) {
    const lot = emails.slice(i, Math.min(i + LOT, MAX_EMAILS));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(lot.map((email) => ({
        from: expediteurDe(nom, association?.slug ?? ""), to: [email], ...(contact ? { reply_to: contact } : {}),
        subject: marquerLEssai(sujetDeLaRelance(action.titre), d.essai), text: texte, html: htmlDuTexte(texte),
      }))),
    });
    if (res.ok) envoyes += lot.length;
    else console.error("[relancer-planning] Resend", res.status, await res.text());
  }
  return envoyes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const demande = await lireLaDemande(req);
    if (demande instanceof Response) return demande;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: action } = await sb.from("actions").select("id, tenant_id, titre, date_action, ouvert_aux_membres, creneau_debut").eq("id", demande.actionId).single();
    if (!action || action.tenant_id !== demande.tenantId) return reponse({ error: "not_found" }, 404);
    if (!action.creneau_debut) return reponse({ error: "no_planning" }, 400);
    if (demande.apercu) {
      const prevus = await chercherLesDestinataires(sb, demande);
      return reponse({ nb_notifications: prevus.parNotification.length, nb_emails: Math.min(prevus.parEmail.length, MAX_EMAILS) });
    }
    // Relancer un planning que les membres ne voient pas n'aurait pas de sens : on l'ouvre d'abord.
    // Un essai, lui, ne touche à rien : ni au planning, ni à l'historique des relances.
    if (!demande.essai && !action.ouvert_aux_membres) await sb.from("actions").update({ ouvert_aux_membres: true }).eq("id", action.id);
    const destinataires = demande.essai ? await chercherLeDestinataireDeLEssai(sb, demande) : await chercherLesDestinataires(sb, demande);
    const { data: nomAsso } = await sb.rpc("branding_for_tenant", { p_tenant: demande.tenantId });
    const titre = (nomAsso?.tenant_name || nomAsso?.name || action.titre).trim();
    const nbNotifications = await envoyerLesNotifications(sb, demande, titre, destinataires.parNotification);
    const nbEmails = await envoyerLesEmails(sb, demande, action as Action, destinataires.parEmail);
    if (demande.essai) return reponse({ nb_notifications: nbNotifications, nb_emails: nbEmails, essai: true });
    await sb.from("relances_planning").insert({
      tenant_id: demande.tenantId, action_id: action.id, envoye_par: demande.moi, message: demande.message,
      nb_notifications: nbNotifications, nb_emails: nbEmails,
    });
    return reponse({ nb_notifications: nbNotifications, nb_emails: nbEmails, ouvert: true });
  } catch (err) {
    console.error("[relancer-planning] Erreur", err);
    return reponse({ error: "internal" }, 500);
  }
});
