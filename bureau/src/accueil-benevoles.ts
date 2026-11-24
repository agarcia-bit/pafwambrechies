import { chargerLeBilan, periodesDuBilan, resumeDuBilan } from './bilan';
import { resumeDesTrous, tranchesDeLaJournee, trousDuPlanning, type Pole } from './creneaux';
import { daysUntil, supabase } from './lib';
import { jourLocal, resumeDuPointage, type Presence } from './pointage';

// Ce que la vue d'ensemble dit des bénévoles : la prochaine action qui a un planning (et ce qui y
// manque), la dernière action passée encore à pointer, et le bilan de l'année. Une phrase d'accueil
// résume le plus pressé.

export type ActionDuPlanning = { id: number; titre: string; emoji: string | null; date: string };
export type ProchaineAction = ActionDuPlanning & { dansJours: number; manque: number; poleLePlusEnManque: string | null };
export type APointer = ActionDuPlanning & { aPointer: number };
export type EtatDesBenevoles = { prochaine: ProchaineAction | null; aPointer: APointer | null; benevoles: number; creneaux: number };

const COLONNES = 'id, titre, emoji, date_action, creneau_debut, creneau_fin, creneau_duree_minutes';
type LigneAction = { id: number; titre: string; emoji: string | null; date_action: string; creneau_debut: string; creneau_fin: string; creneau_duree_minutes: number };
type InscritLu = { id: number; pole_id: number; debut: string; membre: string | null; nom: string; presence: Presence | null };

const versAction = (l: LigneAction): ActionDuPlanning => ({ id: l.id, titre: l.titre, emoji: l.emoji, date: l.date_action });

async function chargerLaProchaine(aujourdhui: string): Promise<ProchaineAction | null> {
  const { data } = await supabase.from('actions').select(COLONNES).not('creneau_debut', 'is', null)
    .gte('date_action', aujourdhui).order('date_action').limit(1);
  const ligne = (data as LigneAction[] | null)?.[0];
  if (!ligne) return null;
  const [poles, inscrits] = await Promise.all([
    supabase.from('poles').select('id, nom, personnes, besoins_par_creneau, ordre').eq('action_id', ligne.id),
    supabase.rpc('inscrits_de_l_action', { p_action: ligne.id }),
  ]);
  const tranches = tranchesDeLaJournee({ debut: ligne.creneau_debut.slice(0, 5), fin: ligne.creneau_fin.slice(0, 5), dureeMinutes: ligne.creneau_duree_minutes });
  const trous = trousDuPlanning((poles.data as Pole[] | null) ?? [], tranches, (inscrits.data as InscritLu[] | null) ?? []);
  return { ...versAction(ligne), dansJours: daysUntil(ligne.date_action), ...resumeDesTrous(trous) };
}

/** La dernière action des deux semaines passées où il reste des personnes à pointer. */
async function chargerLaDerniereAPointer(aujourdhui: string): Promise<APointer | null> {
  const ilYADeuxSemaines = jourLocal(new Date(Date.now() - 14 * 86400000));
  const { data } = await supabase.from('actions').select(COLONNES).not('creneau_debut', 'is', null)
    .lt('date_action', aujourdhui).gte('date_action', ilYADeuxSemaines).order('date_action', { ascending: false }).limit(3);
  for (const ligne of (data as LigneAction[] | null) ?? []) {
    const { data: inscrits } = await supabase.rpc('inscrits_de_l_action', { p_action: ligne.id });
    const { aPointer } = resumeDuPointage((inscrits as InscritLu[] | null) ?? []);
    if (aPointer > 0) return { ...versAction(ligne), aPointer };
  }
  return null;
}

export async function chargerLEtatDesBenevoles(): Promise<EtatDesBenevoles> {
  const aujourdhui = jourLocal();
  const [prochaine, aPointer, bilan] = await Promise.all([
    chargerLaProchaine(aujourdhui), chargerLaDerniereAPointer(aujourdhui), chargerLeBilan(periodesDuBilan(aujourdhui)[0]).catch(() => []),
  ]);
  const { benevoles, creneaux } = resumeDuBilan(bilan);
  return { prochaine, aPointer, benevoles, creneaux };
}

const quand = (jours: number) => (jours === 0 ? 'aujourd’hui' : jours === 1 ? 'demain' : `dans ${jours} jours`);

/**
 * La phrase d'accueil : le plus pressé d'abord. « « Marché de Noël » dans 5 jours : il manque
 * 3 personnes. », sinon ce qui reste à pointer, sinon « Rien d'urgent côté bénévoles. »
 */
export function phraseDesBenevoles(etat: Pick<EtatDesBenevoles, 'prochaine' | 'aPointer'>): string {
  const { prochaine, aPointer } = etat;
  if (prochaine?.manque) {
    return `« ${prochaine.titre} » ${quand(prochaine.dansJours)} : il manque ${prochaine.manque} personne${prochaine.manque > 1 ? 's' : ''}.`;
  }
  if (aPointer) return `« ${aPointer.titre} » est passée : ${aPointer.aPointer} personne${aPointer.aPointer > 1 ? 's' : ''} à pointer.`;
  if (prochaine) return `« ${prochaine.titre} » ${quand(prochaine.dansJours)} : le planning est complet.`;
  return 'Rien d’urgent côté bénévoles.';
}
