import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

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
    const actu = payload.record;
    if (!actu) return new Response("No record", { status: 400 });

    const { data: subs, error } = await sb.from("push_subscriptions").select("*");
    if (error) {
      console.error("DB error:", error);
      return new Response("DB error", { status: 500 });
    }
    if (!subs?.length) return new Response("No subscribers", { status: 200 });

    const notification = JSON.stringify({
      title: actu.titre || "Nouvelle actualité",
      body: "Nouvelle publication sur PAF Wambrechies",
      url: "/",
    });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification
        )
      )
    );

    const failed = results.filter(r => r.status === "rejected");
    failed.forEach(f => console.error("Push error:", (f as PromiseRejectedResult).reason));
    console.log(`[notify-new-actu] Sent: ${subs.length - failed.length}/${subs.length}`);

    return new Response(JSON.stringify({ sent: subs.length - failed.length, total: subs.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-new-actu] Error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
