import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// The bureau's discussion (supabase/bureau_discussion.sql): a general thread (fil 0) and
// one per Pilotage action (fil = the action's id). Bureau and admins only (RLS). Messages
// arrive live (Realtime); what each one has read is kept server-side, so the counts match
// between the phone and the bureau's website.

export type BureauMessage = {
  id: number;
  action_id: number | null;
  auteur: string | null;
  auteur_nom: string | null;
  texte: string;
  created_at: string;
};

const COLUMNS = 'id, action_id, auteur, auteur_nom, texte, created_at';
const filOf = (m: { action_id: number | null }) => m.action_id ?? 0;

export function useBureauMessages(fil: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  const key = ['bureau-messages', fil];

  useEffect(() => {
    const channel = supabase
      .channel(`bureau-fil-${fil}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bureau_messages', filter: `tenant_id=eq.${profile.tenant_id}` },
        (payload) => {
          const message = payload.new as BureauMessage;
          if (filOf(message) !== fil) return;
          client.setQueryData<BureauMessage[]>(['bureau-messages', fil], (list) =>
            list && !list.some((m) => m.id === message.id) ? [...list, message] : list
          );
          if (AppState.currentState === 'active') markBureauRead(fil).then(() => client.invalidateQueries({ queryKey: ['bureau-unread'] }));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bureau_messages' }, (payload) => {
        const id = (payload.old as { id?: number }).id;
        client.setQueryData<BureauMessage[]>(['bureau-messages', fil], (list) => list?.filter((m) => m.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fil, profile.tenant_id, client]);

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<BureauMessage[]> => {
      let query = supabase.from('bureau_messages').select(COLUMNS).order('created_at').limit(500);
      query = fil ? query.eq('action_id', fil) : query.is('action_id', null);
      const { data, error } = await query;
      if (error) throw error;
      return data as BureauMessage[];
    },
  });
}

export function useSendBureauMessage(fil: number) {
  const { profile } = useMember();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (texte: string) => {
      const { data, error } = await supabase
        .from('bureau_messages')
        .insert({ tenant_id: profile.tenant_id, action_id: fil || null, texte })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as BureauMessage;
    },
    onSuccess: (message) =>
      client.setQueryData<BureauMessage[]>(['bureau-messages', fil], (list) =>
        list && !list.some((m) => m.id === message.id) ? [...list, message] : list
      ),
  });
}

export function useDeleteBureauMessage(fil: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('bureau_messages').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => client.setQueryData<BureauMessage[]>(['bureau-messages', fil], (list) => list?.filter((m) => m.id !== id)),
  });
}

export async function markBureauRead(fil: number) {
  await supabase.rpc('bureau_marquer_lu', { p_fil: fil });
}

/** Messages from the others not read yet, per thread (0 = general thread). */
export function useBureauUnread() {
  const { profile, isBureau } = useMember();
  const client = useQueryClient();

  useEffect(() => {
    if (!isBureau) return;
    const channel = supabase
      .channel(`bureau-non-lus-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bureau_messages', filter: `tenant_id=eq.${profile.tenant_id}` },
        () => client.invalidateQueries({ queryKey: ['bureau-unread'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isBureau, profile.tenant_id, client]);

  const query = useQuery({
    queryKey: ['bureau-unread'],
    enabled: isBureau,
    queryFn: async (): Promise<Map<number, number>> => {
      const { data, error } = await supabase.rpc('bureau_non_lus');
      if (error) throw error;
      return new Map(((data ?? []) as { fil: number; n: number }[]).map((r) => [Number(r.fil), r.n]));
    },
  });
  const counts = query.data ?? new Map<number, number>();
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return { counts, total };
}

/** Whether a new message of the bureau sends me a notification (bureau_sourdine = muted). */
export function useBureauMute() {
  const { profile } = useMember();
  const client = useQueryClient();
  const muted = useQuery({
    queryKey: ['bureau-mute', profile.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bureau_sourdine')
        .select('user_id')
        .eq('user_id', profile.id)
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const toggle = useMutation({
    mutationFn: async (mute: boolean) => {
      const { error } = mute
        ? await supabase.from('bureau_sourdine').insert({ user_id: profile.id, tenant_id: profile.tenant_id })
        : await supabase.from('bureau_sourdine').delete().eq('user_id', profile.id).eq('tenant_id', profile.tenant_id);
      if (error) throw error;
      return mute;
    },
    onSuccess: (mute) => client.setQueryData(['bureau-mute', profile.tenant_id], mute),
  });
  return { muted: muted.data, toggle };
}
