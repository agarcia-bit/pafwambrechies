import { supabase } from './lib';

// L'engagement des adhérents (supabase/engagement.sql) : qui ouvre l'app, lit, réagit, répond et
// propose, sur les 30 derniers jours. Le statut sert à repérer avec qui reprendre contact.

export const PERIODE_JOURS = 30;
/** À partir de ce nombre de jours de visite sur la période, un adhérent est « Actif ». */
export const SEUIL_ACTIF = 6;

export type MembreEngagement = {
  id: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  inscrit_le: string;
  jours_visite: number;
  derniere_visite: string | null;
  actus_lues: number;
  likes: number;
  commentaires: number;
  sondages: number;
  evenements: number;
  idees: number;
  offres: number;
  fiche_annuaire: boolean;
  notifications: boolean;
};

export type Engagement = {
  debut: string | null;
  actus_publiees: number;
  semaines: { semaine: string; actifs: number }[];
  membres: MembreEngagement[];
};

export type Statut = 'actif' | 'occasionnel' | 'decroche' | 'jamais_vu';

export const STATUTS: { cle: Statut; libelle: string; ton: string; aide: string }[] = [
  { cle: 'actif', libelle: 'Actif', ton: 'ok', aide: `${SEUIL_ACTIF} jours de visite ou plus sur ${PERIODE_JOURS}` },
  { cle: 'occasionnel', libelle: 'Occasionnel', ton: 'info', aide: `De 1 à ${SEUIL_ACTIF - 1} jours de visite sur ${PERIODE_JOURS}` },
  { cle: 'decroche', libelle: 'Décroché', ton: 'warn', aide: `Déjà venu, mais pas depuis ${PERIODE_JOURS} jours` },
  { cle: 'jamais_vu', libelle: 'Jamais vu', ton: 'neutral', aide: 'Aucune visite depuis le début du suivi' },
];

export function classerEngagement(membre: Pick<MembreEngagement, 'jours_visite' | 'derniere_visite'>): Statut {
  if (!membre.derniere_visite) return 'jamais_vu';
  if (membre.jours_visite >= SEUIL_ACTIF) return 'actif';
  if (membre.jours_visite >= 1) return 'occasionnel';
  return 'decroche';
}

/** Tout ce que l'adhérent a fait de lui-même, hors visites et lectures. */
export function compterInteractions(membre: MembreEngagement): number {
  return membre.likes + membre.commentaires + membre.sondages + membre.evenements + membre.idees + membre.offres;
}

export function compterParStatut(membres: Pick<MembreEngagement, 'jours_visite' | 'derniere_visite'>[]): Record<Statut, number> {
  const comptes: Record<Statut, number> = { actif: 0, occasionnel: 0, decroche: 0, jamais_vu: 0 };
  for (const membre of membres) comptes[classerEngagement(membre)] += 1;
  return comptes;
}

export async function chargerEngagement(): Promise<Engagement> {
  const { data, error } = await supabase.rpc('engagement_bureau', { p_jours: PERIODE_JOURS });
  if (error) throw error;
  return data as Engagement;
}

const jourIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Les `nombre` dernières semaines (du lundi, comme le serveur), y compris celles sans aucun actif. */
export function completerSemaines(semaines: Engagement['semaines'], nombre: number, aujourdHui = new Date()) {
  const actifsParLundi = new Map(semaines.map((s) => [s.semaine, s.actifs]));
  const lundi = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate() - ((aujourdHui.getDay() + 6) % 7));
  return Array.from({ length: nombre }, (_, rang) => {
    const debut = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() - 7 * (nombre - 1 - rang));
    const semaine = jourIso(debut);
    return { semaine, actifs: actifsParLundi.get(semaine) ?? 0 };
  });
}
