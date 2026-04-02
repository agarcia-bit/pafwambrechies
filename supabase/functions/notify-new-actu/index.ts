import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @deno-types="npm:@types/web-push"
import webpush from "npm:web-push";

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_EMAIL       = Deno.env.get("VAPID_EMAIL") || "mailto:contact@paf-wambrechies.fr";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const payload = await req.json();
    // Webhook Supabase : { type: "INSERT", table: "actus", record: {...} }
    const actu = payload.record;
    if (!actu) return new Response("No record", { status: 400 });

    // Récupérer tous les abonnés push
    const { data: subs, error } = await sb.from("push_subscriptions").select("*");
    if (error || !subs?.length) return new Response("No subscribers", { status: 200 });

    const notification = JSON.stringify({
      title: "PAF Wambrechies",
      body:  actu.titre || "Nouvelle actualité",
      url:   "/",
    });

    // Envoyer à chaque abonné
    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        await webpush.sendNotification(pushSub, notification);
      })
    );

    const failed = results.filter(r => r.status === "rejected").length;
    console.log(`[notify-new-actu] Sent: ${subs.length - failed}/${subs.length}`);

    return new Response(JSON.stringify({ sent: subs.length - failed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-new-actu] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
