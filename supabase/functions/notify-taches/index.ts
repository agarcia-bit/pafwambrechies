// Notifications du Pilotage (Expo push, app Allianceo), lancées toutes les 5 minutes par pg_cron
// (supabase/taches_notifications.sql) avec la clé de service :
//  1. « Andy vous a confié … » dès qu'une tâche est confiée à quelqu'un d'autre que soi, regroupé
//     par personne et par action ;
//  2. à partir de 9 h (Paris), un rappel la veille de l'échéance puis le jour même ;
//  3. les créneaux de présence (creneaux.ts) : le référent prévenu d'une désinscription, et un
//     rappel aux inscrits la veille de l'action.
// Chaque message part une fois : la tâche le note (confiee_notifiee, rappel_veille_le, rappel_jour_le),
// même quand la personne n'a pas de téléphone enregistré. Un toucher ouvre l'action dans l'app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  actionAOuvrir, annoncesAEnvoyer, HEURE_DES_RAPPELS, lendemain, rappelsAEnvoyer, texteDeLAnnonce, texteDuRappel,
  type TacheANotifier,
} from "./regles.ts";
import {
  desistementsAPrevenir, rappelsDeLaVeille, texteDuDesistement, texteDuRappelDeLaVeille, type InscriptionANotifier,
} from "./creneaux.ts";

const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const COLONNES = "id, tenant_id, action_id, libelle, responsable, echeance, statut, confiee_par, confiee_notifiee, rappel_veille_le, rappel_jour_le";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// verify_jwt ne vérifie que la signature : la clé publique anon passerait aussi.
function estLaCleDeService(req: Request): boolean {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "") ?? "";
  try {
    const claims = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

const jourDeParis = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(date);
const heureDeParis = (date: Date) => Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(date));

const nomsDAssociation = new Map<string, string>();
async function nomDeLAssociation(tenantId: string): Promise<string> {
  if (!nomsDAssociation.has(tenantId)) {
    const { data } = await sb.rpc("branding_for_tenant", { p_tenant: tenantId });
    nomsDAssociation.set(tenantId, (data?.tenant_name || data?.name || "Votre association").trim());
  }
  return nomsDAssociation.get(tenantId)!;
}

/** Envoie un message sur tous les téléphones d'une personne ; oublie ceux qui n'existent plus. */
async function envoyerA(tenantId: string, personne: string, texte: string, donnees: Record<string, unknown>): Promise<number> {
  const { data: appareils } = await sb.from("device_tokens").select("id, token").eq("tenant_id", tenantId).eq("user_id", personne);
  if (!appareils?.length) return 0;
  const titre = await nomDeLAssociation(tenantId);
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        ...(EXPO_ACCESS_TOKEN ? { "Authorization": `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(appareils.map((a) => ({ to: a.token, title: titre, body: texte, sound: "default", data: donnees }))),
    });
    const json = await res.json();
    if (!res.ok || !Array.isArray(json.data)) throw new Error(`HTTP ${res.status}`);
    const disparus = appareils.filter((_, k) => json.data[k]?.details?.error === "DeviceNotRegistered").map((a) => a.id);
    if (disparus.length) await sb.from("device_tokens").delete().in("id", disparus);
    return json.data.filter((t: { status: string }) => t.status === "ok").length;
  } catch (err) {
    console.error("[notify-taches] Expo", err);
    return 0;
  }
}

async function envoyerLesAnnonces(taches: TacheANotifier[]): Promise<number> {
  const annonces = annoncesAEnvoyer(taches);
  if (!annonces.length) return 0;
  const [{ data: profils }, { data: actions }] = await Promise.all([
    sb.from("profiles").select("id, prenom").in("id", [...new Set(annonces.map((a) => a.confieePar).filter(Boolean))] as string[]),
    sb.from("actions").select("id, titre").in("id", [...new Set(annonces.map((a) => a.actionId))]),
  ]);
  let envoyes = 0;
  for (const a of annonces) {
    const prenom = profils?.find((p) => p.id === a.confieePar)?.prenom ?? null;
    const titre = actions?.find((x) => x.id === a.actionId)?.titre ?? null;
    envoyes += await envoyerA(a.tenantId, a.responsable, texteDeLAnnonce(prenom, titre, a.libelles), { bureau_action: a.actionId });
    await sb.from("taches").update({ confiee_notifiee: true }).in("id", a.ids);
  }
  return envoyes;
}

async function envoyerLesRappels(taches: TacheANotifier[], aujourdhui: string): Promise<number> {
  let envoyes = 0;
  const maintenant = new Date().toISOString();
  for (const personne of rappelsAEnvoyer(taches, aujourdhui)) {
    envoyes += await envoyerA(personne.tenantId, personne.responsable, texteDuRappel(personne.rappels), { bureau_action: actionAOuvrir(personne.rappels) });
    for (const jalon of ["jour", "veille"] as const) {
      const ids = personne.rappels.filter((r) => r.jalon === jalon).map((r) => r.id);
      if (ids.length) await sb.from("taches").update({ [`rappel_${jalon}_le`]: maintenant }).in("id", ids);
    }
  }
  return envoyes;
}

const COLONNES_CRENEAUX =
  "id, tenant_id, debut, membre, annulee_le, annulation_notifiee, rappel_veille_le, poles!inner(nom, actions!inner(id, titre, date_action, referent, creneau_duree_minutes))";

/** Le référent apprend qu'une place s'est libérée ; chaque désinscription n'est annoncée qu'une fois. */
async function envoyerLesDesistements(): Promise<number> {
  const { data, error } = await sb.from("inscriptions_creneaux").select(COLONNES_CRENEAUX).eq("annulation_notifiee", false);
  if (error) throw error;
  const inscriptions = (data ?? []) as unknown as InscriptionANotifier[];
  if (!inscriptions.length) return 0;
  const desistements = desistementsAPrevenir(inscriptions);
  const { data: profils } = await sb.from("profiles").select("id, prenom").in("id", desistements.map((d) => d.membre).filter(Boolean) as string[]);
  let envoyes = 0;
  for (const d of desistements) {
    const prenom = profils?.find((p) => p.id === d.membre)?.prenom ?? null;
    const titre = inscriptions.find((i) => i.poles.actions.id === d.actionId)!.poles.actions.titre;
    envoyes += await envoyerA(d.tenantId, d.referent, texteDuDesistement(prenom, titre, d.texteDuCreneau), { bureau_action: d.actionId });
  }
  await sb.from("inscriptions_creneaux").update({ annulation_notifiee: true }).in("id", inscriptions.map((i) => i.id));
  return envoyes;
}

/** La veille de l'action, chaque inscrit reçoit un rappel de ses créneaux, une seule fois. */
async function envoyerLesRappelsDeCreneaux(aujourdhui: string): Promise<number> {
  const demain = lendemain(aujourdhui);
  const { data, error } = await sb.from("inscriptions_creneaux").select(COLONNES_CRENEAUX)
    .eq("poles.actions.date_action", demain).is("annulee_le", null).is("rappel_veille_le", null).not("membre", "is", null);
  if (error) throw error;
  let envoyes = 0;
  for (const rappel of rappelsDeLaVeille((data ?? []) as unknown as InscriptionANotifier[], demain)) {
    envoyes += await envoyerA(rappel.tenantId, rappel.membre, texteDuRappelDeLaVeille(rappel), { planning_action: rappel.actionId });
    await sb.from("inscriptions_creneaux").update({ rappel_veille_le: new Date().toISOString() }).in("id", rappel.ids);
  }
  return envoyes;
}

Deno.serve(async (req) => {
  if (!estLaCleDeService(req)) return new Response("Forbidden", { status: 403 });
  try {
    const maintenant = new Date();
    const aujourdhui = jourDeParis(maintenant);
    const avecRappels = heureDeParis(maintenant) >= HEURE_DES_RAPPELS;
    // Seulement ce qui peut donner un message : à annoncer, ou à échéance aujourd'hui ou demain.
    const filtre = avecRappels
      ? `confiee_notifiee.eq.false,echeance.in.(${aujourdhui},${lendemain(aujourdhui)})`
      : "confiee_notifiee.eq.false";
    const { data, error } = await sb.from("taches").select(COLONNES).neq("statut", "Terminé").not("responsable", "is", null).or(filtre);
    if (error) throw error;
    const taches = (data ?? []) as TacheANotifier[];

    const annonces = await envoyerLesAnnonces(taches);
    // Les tâches tout juste annoncées attendent le prochain passage pour leur rappel.
    const rappels = avecRappels ? await envoyerLesRappels(taches, aujourdhui) : 0;
    const desistements = await envoyerLesDesistements();
    const rappelsDeCreneaux = avecRappels ? await envoyerLesRappelsDeCreneaux(aujourdhui) : 0;
    if (annonces || rappels || desistements || rappelsDeCreneaux) {
      console.log(`[notify-taches] ${aujourdhui}: ${annonces} annonce(s), ${rappels} rappel(s), ${desistements} désistement(s), ${rappelsDeCreneaux} rappel(s) de créneau`);
    }
    return Response.json({ annonces, rappels, desistements, rappelsDeCreneaux });
  } catch (err) {
    console.error("[notify-taches] Erreur", err);
    return new Response("Internal error", { status: 500 });
  }
});
