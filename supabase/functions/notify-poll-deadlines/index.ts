// Reminds the members who have not answered a poll that its deadline is near:
// 7 days before, 3 days before and the day before (Expo push, Allianceo app).
// Called every morning by pg_cron (supabase/sondages_rappels_cron.sql) with the
// service_role key. Each reminder goes out once (sondage_rappels). Reminders that
// fall on or before the day the poll was published are skipped, and when several are
// due at once (the job did not run for a few days) only the most urgent is sent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const MILESTONES = [7, 3, 1] as const; // days before the deadline, most distant first

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

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function wording(days: number): string {
  if (days === 1) return "Dernier jour demain pour répondre";
  if (days === 3) return "Plus que 3 jours pour répondre";
  return "Plus qu’une semaine pour répondre";
}

async function pushTo(tokens: { id: number; token: string }[], title: string, body: string, sondageId: number) {
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
          data: { sondage_id: sondageId },
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

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const today = parisDay(new Date());
    const { data: polls, error } = await sb
      .from("sondages")
      .select("id, tenant_id, question, date_limite, created_at, sondage_rappels(jours)")
      .eq("actif", true)
      .not("date_limite", "is", null)
      .gt("date_limite", today); // the deadline day itself is too late for any reminder
    if (error) throw error;

    const summary: { sondage: number; jours: number; sent: number }[] = [];
    for (const poll of polls ?? []) {
      const alreadySent = new Set((poll.sondage_rappels as { jours: number }[]).map((r) => r.jours));
      const published = parisDay(new Date(poll.created_at));
      const left = daysBetween(today, poll.date_limite as string);

      // Milestones reached today or earlier, and published before the reminder day.
      const due = MILESTONES.filter((n) => left <= n && !alreadySent.has(n));
      if (!due.length) continue;
      const worthSending = due.filter((n) => daysBetween(published, poll.date_limite as string) > n);
      const mostUrgent = worthSending.length ? Math.min(...worthSending) : null;

      let sent = 0;
      if (mostUrgent !== null) {
        const [{ data: answers }, { data: devices }] = await Promise.all([
          sb.from("sondage_reponses").select("user_id").eq("sondage_id", poll.id),
          sb.from("device_tokens").select("id, token, user_id").eq("tenant_id", poll.tenant_id),
        ]);
        const answered = new Set((answers ?? []).map((a) => a.user_id));
        const targets = (devices ?? []).filter((d) => !answered.has(d.user_id));
        sent = await pushTo(targets, wording(mostUrgent), truncate(String(poll.question), 140), poll.id);
      }
      // Whatever was skipped or sent, these reminders are done.
      await sb.from("sondage_rappels").upsert(due.map((jours) => ({ sondage_id: poll.id, jours })));
      summary.push({ sondage: poll.id, jours: mostUrgent ?? 0, sent });
    }
    console.log(`[notify-poll-deadlines] ${today}: ${JSON.stringify(summary)}`);
    return Response.json({ today, summary });
  } catch (err) {
    console.error("[notify-poll-deadlines] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
