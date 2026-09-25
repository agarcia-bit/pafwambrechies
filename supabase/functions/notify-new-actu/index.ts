// Notifies the members of the association that published a new actu:
// web push (PAF PWA) and Expo push (Allianceo native app, iOS + Android).
// Called by the on_new_actu database webhook with the service_role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7"; // npm:web-push crashes the edge runtime

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_EMAIL       = Deno.env.get("VAPID_EMAIL") || "mailto:contact@paf-wambrechies.fr";
// Only needed once "enhanced push security" is enabled on the Expo project.
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");

const EXPO_PUSH_URL   = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type Notification = { title: string; body: string; actuId: number };
type Outcome = { sent: number; failed: number; removed: number };

// verify_jwt only checks the signature, so the public anon key passes it too.
// The gateway has already verified the token: its claims can be trusted.
function isServiceRole(req: Request): boolean {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "") ?? "";
  try {
    const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

async function sendWebPush(tenantId: string, n: Notification): Promise<Outcome> {
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const payload = JSON.stringify({ title: n.title, body: n.body, url: "/" });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  );

  // 404/410: the browser unsubscribed or the subscription expired.
  const gone: number[] = [];
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") return;
    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
    if (status === 404 || status === 410) {
      gone.push(subs[i].id);
    } else {
      failed++;
      console.error("Web push error:", r.reason);
    }
  });
  if (gone.length) await sb.from("push_subscriptions").delete().in("id", gone);
  return { sent: subs.length - failed - gone.length, failed, removed: gone.length };
}

async function sendExpoPush(tenantId: string, n: Notification): Promise<Outcome> {
  const { data: devices, error } = await sb
    .from("device_tokens")
    .select("id, token")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const batches = [];
  for (let i = 0; i < devices.length; i += EXPO_BATCH_SIZE) {
    batches.push(devices.slice(i, i + EXPO_BATCH_SIZE));
  }

  const outcome: Outcome = { sent: 0, failed: 0, removed: 0 };
  const gone: number[] = [];
  await Promise.all(batches.map(async (batch) => {
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
          title: n.title,
          body: n.body,
          sound: "default",
          data: { actu_id: n.actuId },
        }))),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) {
        throw new Error(`HTTP ${res.status} ${JSON.stringify(json.errors ?? json)}`);
      }
      // Tickets come back in the same order as the messages.
      json.data.forEach((ticket: { status: string; message?: string; details?: { error?: string } }, i: number) => {
        if (ticket.status === "ok") {
          outcome.sent++;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          gone.push(batch[i].id);
        } else {
          outcome.failed++;
          console.error("Expo push error:", ticket.message);
        }
      });
    } catch (err) {
      outcome.failed += batch.length;
      console.error("Expo push error:", err);
    }
  }));
  if (gone.length) await sb.from("device_tokens").delete().in("id", gone);
  outcome.removed = gone.length;
  return outcome;
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return new Response("Forbidden", { status: 403 });
  try {
    const actu = (await req.json()).record;
    if (!actu?.tenant_id) return new Response("No record", { status: 400 });

    const { data: branding } = await sb.rpc("branding_for_tenant", { p_tenant: actu.tenant_id });
    const notification: Notification = {
      title: actu.titre || "Nouvelle actualité",
      body: `Nouvelle publication sur ${branding?.tenant_name || branding?.name || "votre association"}`,
      actuId: actu.id,
    };

    const [web, expo] = await Promise.all([
      sendWebPush(actu.tenant_id, notification),
      sendExpoPush(actu.tenant_id, notification),
    ]);
    console.log(`[notify-new-actu] ${branding?.slug}: web ${JSON.stringify(web)}, expo ${JSON.stringify(expo)}`);
    return Response.json({ web, expo });
  } catch (err) {
    console.error("[notify-new-actu] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
