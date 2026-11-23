import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Relance } from '@/lib/creneaux';
import { supabase } from '@/lib/supabase';

// La relance d'un planning depuis le Pilotage (supabase/relances_planning.sql, fonction
// relancer-planning), comme dans l'espace bureau : la dernière relance, l'aperçu (combien de
// personnes seraient prévenues, sans rien envoyer) et l'envoi.

export type Apercu = { nb_notifications: number; nb_emails: number };

const cleRelance = (actionId: number) => ['relance', actionId];

export function useDerniereRelance(actionId: number) {
  return useQuery({
    queryKey: cleRelance(actionId),
    queryFn: async (): Promise<Relance | null> => {
      const { data, error } = await supabase.from('relances_planning').select('created_at, nb_notifications, nb_emails')
        .eq('action_id', actionId).order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] as Relance | undefined) ?? null;
    },
  });
}

/** Ce que renvoie la fonction en ligne, ou l'erreur qu'elle a donnée (« forbidden », « no_planning »…). */
async function appelerLaRelance(corps: Record<string, unknown>): Promise<Apercu> {
  const { data, error } = await supabase.functions.invoke('relancer-planning', { body: corps });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'internal');
  }
  return data as Apercu;
}

export function useApercuDeRelance(actionId: number) {
  return useQuery({ queryKey: ['relance-apercu', actionId], queryFn: () => appelerLaRelance({ action_id: actionId, apercu: true }), staleTime: 0 });
}

/** Envoie la relance ; le planning (peut-être ouvert aux membres) et la dernière relance se relisent. */
export function useEnvoyerLaRelance(actionId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => appelerLaRelance({ action_id: actionId, message }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: cleRelance(actionId) }),
      client.invalidateQueries({ queryKey: ['planning', actionId] }),
    ]),
  });
}

/** Le message à afficher quand la relance n'a pas pu partir. */
export function messageDeLaRelance(erreur: unknown): string {
  const code = (erreur as Error)?.message;
  if (code === 'forbidden') return 'Seul le bureau peut prévenir les membres.';
  if (code === 'no_planning') return 'Préparez d’abord le planning (horaires et pôles).';
  return 'La relance n’a pas pu partir. Réessayez dans un instant.';
}
