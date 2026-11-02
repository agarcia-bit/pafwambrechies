// Tells the rest of the bureau that a message was posted in its discussion (Expo push,
// Allianceo app): the general thread, or the thread of a Pilotage action. Called by the
// on_new_bureau_message database webhook with the service_role key. Members who muted
// the discussion (bureau_sourdine) are skipped. A tap opens the thread.
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

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record?.tenant_id) return new Response("No record", { status: 400 });

    const [{ data: staff, error }, { data: muted }] = await Promise.all([
      sb.from("profiles").select("id").eq("tenant_id", record.tenant_id).in("role", ["bureau", "admin"]),
      sb.from("bureau_sourdine").select("user_id").eq("tenant_id", record.tenant_id),
    ]);
    if (error) throw error;
    const skip = new Set([record.auteur, ...(muted ?? []).map((m) => m.user_id)]);
    const ids = (staff ?? []).map((p) => p.id).filter((id) => !skip.has(id));
    if (!ids.length) return Response.json({ sent: 0 });

    const { data: devices, error: devError } = await sb
      .from("device_tokens")
      .select("id, token")
      .eq("tenant_id", record.tenant_id)
      .in("user_id", ids);
    if (devError) throw devError;

    const { data: branding } = await sb.rpc("branding_for_tenant", { p_tenant: record.tenant_id });
    const assoc = (branding?.tenant_name || branding?.name || "Votre association").trim();
    let where = "Bureau";
    if (record.action_id) {
      const { data: action } = await sb.from("actions").select("titre").eq("id", record.action_id).maybeSingle();
      if (action?.titre) where = `Bureau · ${action.titre}`;
    }
    const who = String(record.auteur_nom || "Un membre").split(" ")[0];
    const body = truncate(`${where}\n${who} : ${record.texte}`, 200);

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
          body,
          sound: "default",
          data: { bureau_fil: record.action_id ?? 0 },
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
    console.log(`[notify-bureau-message] tenant ${record.tenant_id}: ${sent} sent`);
    return Response.json({ sent });
  } catch (err) {
    console.error("[notify-bureau-message] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
