// Notifications du Pilotage (Expo push, app Allianceo), lancées toutes les 5 minutes par pg_cron
// (supabase/taches_notifications.sql) avec la clé de service :
//  1. « Andy vous a confié … » dès qu'une tâche est confiée à quelqu'un d'autre que soi, regroupé
//     par personne et par action ;
//  2. à partir de 9 h (Paris), un rappel la veille de l'échéance puis le jour même ;
//  3. les créneaux de présence (creneaux.ts) : le référent prévenu d'une désinscription, et un
//     rappel aux inscrits la veille de l'action ;
//  4. les événements proposés par les membres (propositions.ts) : le bureau prévenu d'une
//     proposition, puis l'auteur de la réponse du bureau ;
//  5. le remplacement d'un créneau (remplacements.ts) : la personne remplacée prévenue qu'elle est
//     libérée, et le référent, la veille, des places restées sans remplaçant ;
//  6. l'échange d'un créneau contre un autre (echanges.ts) : les personnes visées prévenues, puis
//     celle qui proposait quand c'est accepté.
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
import { texteDeLaPropositionDEchange, texteDeLEchangeAccepte, type EchangeANotifier } from "./echanges.ts";
import { placesSansRemplacant, texteDeLaReprise, texteSansRemplacant, type InscriptionRemplacee } from "./remplacements.ts";
import { bureauAPrevenir, reponseALAuteur, texteDeLaProposition, type PropositionANotifier } from "./propositions.ts";

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

const COLONNES_REMPLACEMENT = `${COLONNES_CRENEAUX}, remplacant_recherche_le, reprise_par, reprise_notifiee, sans_remplacant_signale_le`;

/** Quelqu'un a repris une place : la personne remplacée l'apprend, une seule fois. */
async function envoyerLesReprises(): Promise<number> {
  const { data, error } = await sb.from("inscriptions_creneaux").select(COLONNES_REMPLACEMENT).eq("reprise_notifiee", false);
  if (error) throw error;
  const reprises = (data ?? []) as unknown as InscriptionRemplacee[];
  if (!reprises.length) return 0;
  const { data: profils } = await sb.from("profiles").select("id, prenom").in("id", reprises.map((r) => r.reprise_par).filter(Boolean) as string[]);
  let envoyes = 0;
  for (const r of reprises.filter((r) => r.membre)) {
    const prenom = profils?.find((p) => p.id === r.reprise_par)?.prenom ?? null;
    envoyes += await envoyerA(r.tenant_id, r.membre!, texteDeLaReprise(prenom, r), { planning_action: r.poles.actions.id });
  }
  await sb.from("inscriptions_creneaux").update({ reprise_notifiee: true }).in("id", reprises.map((r) => r.id));
  return envoyes;
}

/** La veille de l'action, le référent apprend quelles places n'ont pas trouvé de remplaçant, une seule fois. */
async function envoyerLesPlacesSansRemplacant(aujourdhui: string): Promise<number> {
  const demain = lendemain(aujourdhui);
  const { data, error } = await sb.from("inscriptions_creneaux").select(COLONNES_REMPLACEMENT)
    .eq("poles.actions.date_action", demain).is("annulee_le", null).not("remplacant_recherche_le", "is", null).is("sans_remplacant_signale_le", null);
  if (error) throw error;
  const groupes = placesSansRemplacant((data ?? []) as unknown as InscriptionRemplacee[], demain);
  if (!groupes.length) return 0;
  const membres = groupes.flatMap((g) => g.places.map((p) => p.membre)).filter(Boolean) as string[];
  const { data: profils } = await sb.from("profiles").select("id, prenom").in("id", membres);
  const prenoms = new Map((profils ?? []).map((p) => [p.id as string, p.prenom as string | null]));
  let envoyes = 0;
  for (const groupe of groupes) {
    envoyes += await envoyerA(groupe.tenantId, groupe.referent, texteSansRemplacant(groupe, prenoms), { bureau_action: groupe.actionId });
    await sb.from("inscriptions_creneaux").update({ sans_remplacant_signale_le: new Date().toISOString() }).in("id", groupe.ids);
  }
  return envoyes;
}

const COLONNES_ECHANGES =
  "id, tenant_id, propose_par, pole_vise, debut_vise, statut, offerte:inscriptions_creneaux!inscription_offerte(debut, poles!inner(nom, actions!inner(id, titre, creneau_duree_minutes))), vise:poles!pole_vise(nom)";

/** Un échange proposé : les adhérents inscrits sur le créneau visé l'apprennent, une seule fois. */
async function envoyerLesPropositionsDEchange(): Promise<number> {
  const { data, error } = await sb.from("echanges_creneaux").select(COLONNES_ECHANGES).eq("vises_prevenus", false);
  if (error) throw error;
  const echanges = (data ?? []) as unknown as EchangeANotifier[];
  let envoyes = 0;
  for (const e of echanges.filter((e) => e.statut === "en_attente")) {
    const { data: vises } = await sb.from("inscriptions_creneaux").select("membre")
      .eq("pole_id", e.pole_vise).eq("debut", e.debut_vise).is("annulee_le", null).not("membre", "is", null).neq("membre", e.propose_par);
    for (const v of vises ?? []) {
      envoyes += await envoyerA(e.tenant_id, v.membre as string, texteDeLaPropositionDEchange(e), { planning_action: e.offerte.poles.actions.id });
    }
  }
  if (echanges.length) await sb.from("echanges_creneaux").update({ vises_prevenus: true }).in("id", echanges.map((e) => e.id));
  return envoyes;
}

/** Un échange accepté : la personne qui proposait apprend son nouveau créneau, une seule fois. */
async function envoyerLesEchangesAcceptes(): Promise<number> {
  const { data, error } = await sb.from("echanges_creneaux").select(COLONNES_ECHANGES).eq("auteur_prevenu", false);
  if (error) throw error;
  let envoyes = 0;
  for (const e of (data ?? []) as unknown as EchangeANotifier[]) {
    envoyes += await envoyerA(e.tenant_id, e.propose_par, texteDeLEchangeAccepte(e), { planning_action: e.offerte.poles.actions.id });
    await sb.from("echanges_creneaux").update({ auteur_prevenu: true }).eq("id", e.id);
  }
  return envoyes;
}

const COLONNES_PROPOSITIONS = "id, tenant_id, auteur, type, titre, statut, devenue, evenement_id, mot_du_bureau, repetition";

/** Une proposition arrive : le bureau de l'association est prévenu, une seule fois. */
async function envoyerLesPropositionsAuBureau(): Promise<number> {
  const { data, error } = await sb.from("propositions_evenements").select(COLONNES_PROPOSITIONS).eq("bureau_prevenu", false);
  if (error) throw error;
  const propositions = (data ?? []) as PropositionANotifier[];
  if (!propositions.length) return 0;
  const tenants = [...new Set(propositions.map((p) => p.tenant_id))];
  const [{ data: bureau }, { data: auteurs }] = await Promise.all([
    sb.from("profiles").select("id, tenant_id").in("tenant_id", tenants).in("role", ["bureau", "admin"]),
    sb.from("profiles").select("id, prenom").in("id", propositions.map((p) => p.auteur)),
  ]);
  let envoyes = 0;
  for (const proposition of propositions) {
    const prenom = auteurs?.find((a) => a.id === proposition.auteur)?.prenom ?? null;
    // bureau_action: 0 ouvre le Pilotage de l'app, où le bureau répond aux propositions.
    for (const membre of bureauAPrevenir(proposition, bureau ?? [])) {
      envoyes += await envoyerA(proposition.tenant_id, membre, texteDeLaProposition(prenom, proposition), { bureau_action: 0 });
    }
  }
  await sb.from("propositions_evenements").update({ bureau_prevenu: true }).in("id", propositions.map((p) => p.id));
  return envoyes;
}

/** Le bureau a répondu : l'auteur l'apprend, une seule fois. */
async function envoyerLesReponsesAuxAuteurs(): Promise<number> {
  const { data, error } = await sb.from("propositions_evenements").select(COLONNES_PROPOSITIONS).eq("auteur_prevenu", false);
  if (error) throw error;
  let envoyes = 0;
  for (const proposition of (data ?? []) as PropositionANotifier[]) {
    const { texte, donnees } = reponseALAuteur(proposition);
    envoyes += await envoyerA(proposition.tenant_id, proposition.auteur, texte, donnees);
    await sb.from("propositions_evenements").update({ auteur_prevenu: true }).eq("id", proposition.id);
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
    const propositions = await envoyerLesPropositionsAuBureau() + await envoyerLesReponsesAuxAuteurs();
    const remplacements = await envoyerLesReprises() + (avecRappels ? await envoyerLesPlacesSansRemplacant(aujourdhui) : 0);
    const echanges = await envoyerLesPropositionsDEchange() + await envoyerLesEchangesAcceptes();
    if (annonces || rappels || desistements || rappelsDeCreneaux || propositions || remplacements || echanges) {
      console.log(`[notify-taches] ${aujourdhui}: ${annonces} annonce(s), ${rappels} rappel(s), ${desistements} désistement(s), ${rappelsDeCreneaux} rappel(s) de créneau, ${propositions} message(s) de propositions, ${remplacements} message(s) de remplacement, ${echanges} message(s) d'échange`);
    }
    return Response.json({ annonces, rappels, desistements, rappelsDeCreneaux, propositions, remplacements, echanges });
  } catch (err) {
    console.error("[notify-taches] Erreur", err);
    return new Response("Internal error", { status: 500 });
  }
});
