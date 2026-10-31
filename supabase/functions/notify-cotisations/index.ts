// Weekly reminder (Expo push, Allianceo app) to the members whose membership dues must be renewed:
// the association's renewal campaign is open and the member's end date does not cover it
// (public.cotisations_a_relancer). Called every Monday morning by pg_cron
// (supabase/cotisations_rappels_cron.sql) with the service_role key. A member stops receiving it
// as soon as the bureau records their renewal; without an open campaign nobody is listed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const ID_CHUNK = 100;

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

async function pushTo(tokens: { id: number; token: string }[], title: string, body: string) {
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
          data: { cotisation: true },
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

// Title of every notification: the association's name (as it chose it in its settings).
const names = new Map<string, string>();
async function assocName(tenantId: string): Promise<string> {
  if (!names.has(tenantId)) {
    const { data } = await sb.rpc("branding_for_tenant", { p_tenant: tenantId });
    names.set(tenantId, (data?.tenant_name || data?.name || "Votre association").trim());
  }
  return names.get(tenantId)!;
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const { data: due, error } = await sb.rpc("cotisations_a_relancer");
    if (error) throw error;

    // One message per association (its campaign name goes in the title).
    const byTenant = new Map<string, { libelle: string | null; users: string[] }>();
    for (const row of (due ?? []) as { tenant_id: string; user_id: string; libelle: string | null }[]) {
      const entry = byTenant.get(row.tenant_id) ?? { libelle: row.libelle, users: [] };
      entry.users.push(row.user_id);
      byTenant.set(row.tenant_id, entry);
    }

    const summary: { tenant: string; members: number; sent: number }[] = [];
    for (const [tenant, { libelle, users }] of byTenant) {
      const devices: { id: number; token: string }[] = [];
      for (let i = 0; i < users.length; i += ID_CHUNK) {
        const { data } = await sb
          .from("device_tokens")
          .select("id, token")
          .eq("tenant_id", tenant)
          .in("user_id", users.slice(i, i + ID_CHUNK));
        devices.push(...(data ?? []));
      }
      const body = libelle ? `Votre cotisation ${libelle} est à renouveler.` : "Votre cotisation est à renouveler.";
      const sent = devices.length ? await pushTo(devices, await assocName(tenant), body) : 0;
      summary.push({ tenant, members: users.length, sent });
    }
    console.log(`[notify-cotisations] ${JSON.stringify(summary)}`);
    return Response.json({ summary });
  } catch (err) {
    console.error("[notify-cotisations] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
