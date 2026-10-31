// Tells the bureau members and the admins of an association that a content was reported
// (Expo push, Allianceo app). Called by the on_new_signalement database webhook with the
// service_role key. A tap on the notification opens the reports screen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

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

const KIND_LABELS: Record<string, string> = {
  actus_commentaire: "un commentaire",
  idee_commentaire: "un commentaire",
  idee: "une idée",
  offre: "une offre",
  annuaire: "une fiche de l’annuaire",
};

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record?.tenant_id) return new Response("No record", { status: 400 });

    const { data: staff, error } = await sb
      .from("profiles")
      .select("id")
      .eq("tenant_id", record.tenant_id)
      .in("role", ["bureau", "admin"])
      .neq("id", record.reporter_id);
    if (error) throw error;
    const ids = (staff ?? []).map((p) => p.id);
    if (!ids.length) return Response.json({ sent: 0 });

    const { data: devices, error: devError } = await sb
      .from("device_tokens")
      .select("id, token")
      .eq("tenant_id", record.tenant_id)
      .in("user_id", ids);
    if (devError) throw devError;

    const what = KIND_LABELS[String(record.kind)] ?? "un contenu";
    const { data: branding } = await sb.rpc("branding_for_tenant", { p_tenant: record.tenant_id });
    const assoc = (branding?.tenant_name || branding?.name || "Votre association").trim();
    let sent = 0;
    const gone: number[] = [];
    const tokens = devices ?? [];
    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const batch = tokens.slice(i, i + EXPO_BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(EXPO_ACCESS_TOKEN ? { "Authorization": `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch.map((d) => ({
          to: d.token,
          title: assoc,
          body: `Contenu signalé : un membre a signalé ${what}. À examiner.`,
          sound: "default",
          data: { signalement_id: record.id },
        }))),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) throw new Error(`HTTP ${res.status}`);
      json.data.forEach((ticket: { status: string; details?: { error?: string } }, k: number) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") gone.push(batch[k].id);
      });
    }
    if (gone.length) await sb.from("device_tokens").delete().in("id", gone);
    console.log(`[notify-new-report] tenant ${record.tenant_id}: ${sent} sent`);
    return Response.json({ sent });
  } catch (err) {
    console.error("[notify-new-report] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
