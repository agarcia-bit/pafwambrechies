import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { besoinDuCreneau, etatDuCreneau, tranchesDeLaJournee, type EtatDuCreneau, type Horaires } from './creneaux';
import { supabase } from './supabase';

// Le côté adhérent des créneaux de présence (supabase/creneaux.sql) : les actions que le bureau a
// ouvertes aux membres, le nombre de places par créneau et ceux de la personne. Jamais le nom
// des autres : la fonction plannings_ouverts() ne le renvoie pas.

export type PoleOuvert = {
  id: number;
  nom: string;
  personnes: number;
  besoins_par_creneau: Record<string, number>;
  /** Combien de personnes sont déjà inscrites, par heure de début (« 10:00 »). */
  pris: Record<string, number>;
  /** remplacant_recherche : la personne cherche quelqu'un pour reprendre sa place (supabase/creneaux.sql, section 9). */
  mes_inscriptions: { id: number; debut: string; remplacant_recherche?: boolean }[];
  /** Les places des autres qui cherchent un remplaçant, sans leur nom. */
  a_reprendre?: { id: number; debut: string }[];
};

export type PlanningOuvert = {
  id: number;
  emoji: string | null;
  titre: string;
  date: string;
  debut: string;
  fin: string;
  duree_minutes: number;
  poles: PoleOuvert[];
};

export type CaseDuPlanning = { heure: string; etat: EtatDuCreneau; libres: number; inscription: number | null };

export const horairesDe = (planning: PlanningOuvert): Horaires => ({ debut: planning.debut, fin: planning.fin, dureeMinutes: planning.duree_minutes });

/** Les cases d'un pôle, du point de vue de la personne ; les tranches où le pôle n'a besoin de personne disparaissent. */
export function casesDuPole(planning: PlanningOuvert, pole: PoleOuvert): CaseDuPlanning[] {
  return tranchesDeLaJournee(horairesDe(planning))
    .map((heure) => {
      const besoin = besoinDuCreneau(pole, heure);
      const pris = pole.pris[heure] ?? 0;
      const mienne = pole.mes_inscriptions.find((i) => i.debut === heure);
      return { heure, etat: etatDuCreneau({ besoin, pris, estAMoi: !!mienne }), libres: Math.max(0, besoin - pris), inscription: mienne?.id ?? null };
    })
    .filter((c) => c.etat !== 'ferme');
}

/** Pour la carte de l'Agenda : les places encore libres, et les créneaux de la personne (« Gaufres, 10:00 »). */
export function resumeDuPlanning(planning: PlanningOuvert) {
  let libres = 0;
  const mesCreneaux: { pole: string; heure: string }[] = [];
  for (const pole of planning.poles) {
    for (const c of casesDuPole(planning, pole)) {
      if (c.etat !== 'vous') libres += c.libres;
      else mesCreneaux.push({ pole: pole.nom, heure: c.heure });
    }
  }
  return { libres, mesCreneaux };
}

export type Billet = { inscription: number; pole: number; nomDuPole: string; heure: string; autres: number; remplacantRecherche: boolean };

/** Les créneaux de la personne, dans l'ordre de la journée, avec le nombre d'autres bénévoles. */
export function billetsDuPlanning(planning: PlanningOuvert): Billet[] {
  return planning.poles
    .flatMap((pole) => pole.mes_inscriptions.map((i) => ({
      inscription: i.id, pole: pole.id, nomDuPole: pole.nom, heure: i.debut, autres: Math.max(0, (pole.pris[i.debut] ?? 1) - 1),
      remplacantRecherche: !!i.remplacant_recherche,
    })))
    .sort((a, b) => a.heure.localeCompare(b.heure));
}

export const CLE_DES_PLANNINGS = ['plannings-ouverts'];
const CLE = CLE_DES_PLANNINGS;

export function usePlanningsOuverts() {
  return useQuery({
    queryKey: CLE,
    queryFn: async (): Promise<PlanningOuvert[]> => {
      const { data, error } = await supabase.rpc('plannings_ouverts');
      // Script SQL pas encore appliqué : pas de bloc plutôt qu'un écran en erreur.
      if (error?.code === 'PGRST202') return [];
      if (error) throw error;
      return (data as PlanningOuvert[]) ?? [];
    },
  });
}

/** Prendre un créneau ou le libérer ; dans les deux cas, les places se relisent depuis la base. */
export function useMonCreneau() {
  const client = useQueryClient();
  const relire = () => client.invalidateQueries({ queryKey: CLE });
  const prendre = useMutation({
    /** Rend l'identifiant de la nouvelle inscription (le billet qui doit apparaître). */
    mutationFn: async ({ pole, heure }: { pole: number; heure: string }): Promise<number> => {
      const { data, error } = await supabase.rpc('prendre_creneau', { p_pole: pole, p_debut: heure });
      if (error) throw error;
      return data as number;
    },
    onSettled: relire,
  });
  const liberer = useMutation({
    mutationFn: async (inscription: number) => {
      const { error } = await supabase.rpc('liberer_creneau', { p_inscription: inscription });
      if (error) throw error;
    },
    onSettled: relire,
  });
  return { prendre, liberer };
}
