// Reminds the members who have not said whether they come to an event (Expo push, Allianceo app):
// 7 days before, to those who have not answered; 2 days before, to those who have not answered
// or are still undecided. Called every morning by pg_cron (supabase/evenements_rappels_cron.sql)
// with the service_role key. Each reminder goes out once (evenement_rappels). When several are due
// at once (the event was created late, or the job did not run) only the most urgent is sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const ID_CHUNK = 100;
const MILESTONES = [7, 2] as const; // days before the event, most distant first

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// verify_jwt only checks the signature, so the public anon key passes it too.
function isServiceRole(req: Request): boolean {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "") ?? "";
  try {
    const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" of an instant, in Paris time. */
const parisDay = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(date);

/** Whole days from one "YYYY-MM-DD" to another. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "samedi 14 septembre" */
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${iso}T12:00:00Z`));

async function pushTo(tokens: { id: number; token: string }[], title: string, body: string, evenementId: number) {
  let sent = 0;
  const gone: number[] = [];
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(EXPO_ACCESS_TOKEN ? { "Authorization": `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch.map((d) => ({
          to: d.token,
          title,
          body,
          sound: "default",
          data: { evenement_id: evenementId },
        }))),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) throw new Error(`HTTP ${res.status}`);
      json.data.forEach((ticket: { status: string; details?: { error?: string } }, k: number) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") gone.push(batch[k].id);
      });
    } catch (err) {
      console.error("Expo push error:", err);
    }
  }
  if (gone.length) await sb.from("device_tokens").delete().in("id", gone);
  return sent;
}

type Row = { evenement_id: number; tenant_id: string; titre: string; date: string; user_id: string; reponse: string | null };

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const today = parisDay(new Date());
    const { data, error } = await sb.rpc("evenements_a_relancer");
    if (error) throw error;

    const byEvent = new Map<number, Row[]>();
    for (const row of (data ?? []) as Row[]) byEvent.set(row.evenement_id, [...(byEvent.get(row.evenement_id) ?? []), row]);

    const summary: { evenement: number; jours: number; sent: number }[] = [];
    for (const [id, rows] of byEvent) {
      const { titre, date, tenant_id } = rows[0];
      const left = daysBetween(today, date);
      const { data: done } = await sb.from("evenement_rappels").select("jours").eq("evenement_id", id);
      const alreadySent = new Set((done ?? []).map((r: { jours: number }) => r.jours));

      const due = MILESTONES.filter((n) => left <= n && !alreadySent.has(n));
      if (!due.length) continue;
      const mostUrgent = Math.min(...due);

      // A week before: only those who have not answered. Two days before: the undecided too.
      const users = rows.filter((r) => mostUrgent === 2 || r.reponse === null).map((r) => r.user_id);
      const devices: { id: number; token: string }[] = [];
      for (let i = 0; i < users.length; i += ID_CHUNK) {
        const { data: tokens } = await sb
          .from("device_tokens")
          .select("id, token")
          .eq("tenant_id", tenant_id)
          .in("user_id", users.slice(i, i + ID_CHUNK));
        devices.push(...(tokens ?? []));
      }
      const title = mostUrgent === 2 ? "Plus que 2 jours : vous venez ?" : "Vous venez ?";
      const sent = devices.length ? await pushTo(devices, title, `${titre}, ${longDay(date)}`, id) : 0;

      // Whatever was sent, these reminders are done.
      await sb.from("evenement_rappels").upsert(due.map((jours) => ({ evenement_id: id, jours })));
      summary.push({ evenement: id, jours: mostUrgent, sent });
    }
    console.log(`[notify-evenements] ${today}: ${JSON.stringify(summary)}`);
    return Response.json({ today, summary });
  } catch (err) {
    console.error("[notify-evenements] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
