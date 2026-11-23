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
  mes_inscriptions: { id: number; debut: string }[];
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

const CLE = ['plannings-ouverts'];

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
    mutationFn: async ({ pole, heure }: { pole: number; heure: string }) => {
      const { error } = await supabase.rpc('prendre_creneau', { p_pole: pole, p_debut: heure });
      if (error) throw error;
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
