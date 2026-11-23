import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { libelleDeTranche } from './creneaux';
import { CLE_DES_PLANNINGS } from './mes-creneaux';
import { supabase } from './supabase';

// L'échange d'un créneau contre un autre (supabase/creneaux.sql, section 10) : « je prends ton
// 14 h, tu prends mon 10 h ». On ne voit jamais qui propose ni qui accepte : seulement les deux
// créneaux. notify-taches prévient les personnes visées, puis celle qui proposait.

export type Echange = {
  id: number;
  action: number;
  /** propose : c'est le sien ; recu : quelqu'un propose son créneau contre celui de la personne. */
  sens: 'propose' | 'recu';
  inscription_offerte: number;
  offert: { pole: string; debut: string };
  vise: { pole: string; debut: string };
  mon_inscription: number | null;
};

const CLE = ['mes-echanges'];

/** « Café, 14 h – 16 h » */
const creneau = (c: { pole: string; debut: string }, duree: number) => `${c.pole}, ${libelleDeTranche(c.debut, duree)}`;

/** La phrase d'un échange, du point de vue de la personne. */
export function texteDeLEchange(e: Echange, duree: number): string {
  return e.sens === 'propose'
    ? `Vous proposez votre créneau (${creneau(e.offert, duree)}) contre ${creneau(e.vise, duree)}.`
    : `Quelqu’un propose son créneau (${creneau(e.offert, duree)}) contre le vôtre (${creneau(e.vise, duree)}).`;
}

/** Les échanges d'une action, ceux qu'on reçoit d'abord : ce sont eux qui attendent une réponse. */
export function echangesDeLAction(echanges: Echange[], action: number): Echange[] {
  return echanges.filter((e) => e.action === action).sort((a, b) => (a.sens === b.sens ? 0 : a.sens === 'recu' ? -1 : 1));
}

export function useMesEchanges() {
  return useQuery({
    queryKey: CLE,
    queryFn: async (): Promise<Echange[]> => {
      const { data, error } = await supabase.rpc('mes_echanges');
      // Script SQL pas encore appliqué : pas d'échange plutôt qu'un écran en erreur.
      if (error?.code === 'PGRST202') return [];
      if (error) throw error;
      return (data as Echange[]) ?? [];
    },
  });
}

/** Proposer, annuler ou accepter un échange ; les échanges et les places se relisent. */
export function useEchange() {
  const client = useQueryClient();
  const relire = () => Promise.all([CLE, CLE_DES_PLANNINGS].map((cle) => client.invalidateQueries({ queryKey: cle })));
  const appeler = (fonction: string) => async (args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fonction, args);
    if (error) throw error;
  };
  const proposer = useMutation({
    mutationFn: ({ inscription, pole, heure }: { inscription: number; pole: number; heure: string }) =>
      appeler('proposer_echange')({ p_inscription: inscription, p_pole: pole, p_debut: heure }),
    onSettled: relire,
  });
  const annuler = useMutation({ mutationFn: (id: number) => appeler('annuler_echange')({ p_echange: id }), onSettled: relire });
  const accepter = useMutation({ mutationFn: (id: number) => appeler('accepter_echange')({ p_echange: id }), onSettled: relire });
  return { proposer, annuler, accepter };
}
