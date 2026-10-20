import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NotAllowedError } from '@/lib/admin';
import { daysUntil } from '@/lib/format';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Polls launched by admins (supabase/sondages.sql): single choice among 2 to 6
// options, one answer per member. Answers are visible to admins by name.

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export type SondageOption = { id: number; libelle: string; position: number };
export type Sondage = {
  id: number;
  question: string;
  actif: boolean;
  /** Required: cannot be postponed, the app stays covered until it is answered. */
  obligatoire: boolean;
  /** Last day to answer (YYYY-MM-DD), or null. */
  date_limite: string | null;
  created_at: string;
  sondage_options: SondageOption[];
};
export type MemberSondage = Sondage & { mes_reponses: { option_id: number }[] };
export type Reponse = { option_id: number; user_id: string; created_at: string };
export type AdminSondage = Sondage & { sondage_reponses: Reponse[] };
export type MemberName = { id: string; prenom: string | null; nom: string | null };

/** Open polls the member has not answered yet: they stay at the top of the feed. */
export function usePendingSondages() {
  const { profile } = useMember();
  return useQuery({
    queryKey: ['sondages', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sondages')
        .select(
          'id, question, actif, obligatoire, date_limite, created_at, sondage_options(id, libelle, position), mes_reponses:sondage_reponses(option_id)'
        )
        .eq('actif', true)
        // Admins can read every answer: keep only the member's own.
        .eq('mes_reponses.user_id', profile.id)
        .order('created_at', { ascending: false })
        .order('position', { referencedTable: 'sondage_options' });
      if (error) throw error;
      // A poll past its deadline can no longer be answered: it leaves the feed.
      return (data as MemberSondage[]).filter(
        (s) => s.mes_reponses.length === 0 && (!s.date_limite || daysUntil(s.date_limite) >= 0)
      );
    },
    // The feed must not break (nor keep retrying) if polls are unavailable.
    retry: false,
  });
}

/**
 * Sends the member's answer. It does not refresh the polls by itself: the gate shows
 * its "thank you" animation first, then calls useRefreshSondages().
 */
export function useAnswerSondage() {
  const { profile } = useMember();
  return useMutation({
    mutationFn: async ({ sondageId, optionId }: { sondageId: number; optionId: number }) => {
      const { error } = await supabase
        .from('sondage_reponses')
        .insert({ sondage_id: sondageId, option_id: optionId, user_id: profile.id, tenant_id: profile.tenant_id });
      // Already answered (from another device): the poll is simply done.
      if (error && error.code !== '23505') throw error;
    },
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export type AdminSondages = { sondages: AdminSondage[]; members: MemberName[] };

export function useAdminSondages() {
  return useQuery({
    queryKey: ['sondages', 'admin'],
    queryFn: async (): Promise<AdminSondages> => {
      const [sondages, members] = await Promise.all([
        supabase
          .from('sondages')
          .select(
            'id, question, actif, obligatoire, date_limite, created_at, sondage_options(id, libelle, position), sondage_reponses(option_id, user_id, created_at)'
          )
          .order('created_at', { ascending: false })
          .order('position', { referencedTable: 'sondage_options' }),
        supabase.rpc('member_names'),
      ]);
      if (sondages.error) throw sondages.error;
      if (members.error) throw members.error;
      return { sondages: sondages.data as AdminSondage[], members: members.data as MemberName[] };
    },
  });
}

export function useRefreshSondages() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['sondages'] });
}

/** Creates the poll and its options at once; the database then notifies the members. */
export function useCreateSondage() {
  const refresh = useRefreshSondages();
  return useMutation({
    mutationFn: async ({
      question,
      options,
      obligatoire,
      dateLimite,
    }: {
      question: string;
      options: string[];
      obligatoire: boolean;
      dateLimite: string | null;
    }) => {
      const { error } = await supabase.rpc('creer_sondage', {
        p_question: question,
        p_options: options,
        p_obligatoire: obligatoire,
        p_date_limite: dateLimite,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useSetSondageActif() {
  const refresh = useRefreshSondages();
  return useMutation({
    mutationFn: async ({ id, actif }: { id: number; actif: boolean }) => {
      const { data, error } = await supabase.from('sondages').update({ actif }).eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new NotAllowedError();
    },
    onSuccess: refresh,
  });
}

export function useDeleteSondage() {
  const refresh = useRefreshSondages();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.from('sondages').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data.length) throw new NotAllowedError();
    },
    onSuccess: refresh,
  });
}

/** Votes per option and the voters of each, for the admin results screen. */
export function sondageResults(sondage: AdminSondage, members: MemberName[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const name = (id: string) => {
    const m = byId.get(id);
    return [m?.prenom, m?.nom].filter(Boolean).join(' ') || 'Ancien membre';
  };
  return sondage.sondage_options.map((option) => {
    const votes = sondage.sondage_reponses.filter((r) => r.option_id === option.id);
    return { option, count: votes.length, voters: votes.map((v) => name(v.user_id)).sort((a, b) => a.localeCompare(b)) };
  });
}
