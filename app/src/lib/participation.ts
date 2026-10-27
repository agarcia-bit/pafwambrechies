import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { useEvenements } from '@/lib/data';
import { daysUntil } from '@/lib/format';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTenantConfig } from '@/lib/tenant-config';
import type { Evenement } from '@/lib/types';

// "Who comes" to an event (supabase/evenements_participation.sql). The bureau turns it on per
// event; from a week before, a member who has not answered sees a red strip on the home, and the
// app asks them at launch. "Not sure yet" counts as an answer for the bureau, but the question
// comes back the next time the app is opened.

export type Reponse = 'present' | 'absent' | 'indecis';

export const REPONSE_LABELS: Record<Reponse, string> = {
  present: 'Présent',
  absent: 'Absent',
  indecis: 'Je ne sais pas encore',
};

/** Days before the event from which the members are asked. */
export const ASK_DAYS = 7;

// ── The member's answers ─────────────────────────────────────────────────────

/** The member's own answers, by event id. */
export function useMyReponses() {
  const { profile } = useMember();
  return useQuery({
    queryKey: ['participation', 'mine', profile.id],
    queryFn: async (): Promise<Record<number, Reponse>> => {
      const { data, error } = await supabase
        .from('evenement_reponses')
        .select('evenement_id, reponse')
        .eq('user_id', profile.id);
      if (error) throw error;
      return Object.fromEntries((data as { evenement_id: number; reponse: Reponse }[]).map((r) => [r.evenement_id, r.reponse]));
    },
    // The feed must not break (nor keep retrying) if the answers are unavailable.
    retry: false,
  });
}

export function useAnswerEvenement() {
  const { profile } = useMember();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ evenementId, reponse }: { evenementId: number; reponse: Reponse }) => {
      const { error } = await supabase.from('evenement_reponses').upsert(
        {
          evenement_id: evenementId,
          tenant_id: profile.tenant_id,
          user_id: profile.id,
          reponse,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'evenement_id,user_id' }
      );
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['participation'] }),
  });
}

// ── What the member is asked ─────────────────────────────────────────────────

/** Pure: the events asking for an answer within a week that the member has not settled. */
export function eventsToAnswer(events: Evenement[], answers: Record<number, Reponse>): Evenement[] {
  return events.filter(
    (ev) => ev.participation && daysUntil(ev.date) <= ASK_DAYS && (!answers[ev.id] || answers[ev.id] === 'indecis')
  );
}

// Events the member answered "not sure yet" at launch: they are not asked again until the app
// is reopened (this lives in memory only, on purpose).
const putOff = new Set<number>();
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function putOffForNow(evenementId: number) {
  putOff.add(evenementId);
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Events to answer, and those among them that must be asked at the front of the app right now. */
export function useParticipationQueue() {
  const { modules } = useTenantConfig();
  const events = useEvenements();
  const mine = useMyReponses();
  useSyncExternalStore(subscribe, () => version);

  // Until the answers are known, nobody is asked (the question must not flash and disappear).
  const pending = modules.agenda && mine.data ? eventsToAnswer(events.data ?? [], mine.data) : [];
  return { pending, gated: pending.filter((ev) => !putOff.has(ev.id)) };
}

// ── Bureau ───────────────────────────────────────────────────────────────────

export type Participant = { id: string; prenom: string | null; nom: string | null; reponse: Reponse | null };

/** Every member of the association with their answer to an event (bureau and admins only). */
export function useParticipants(evenementId: number) {
  return useQuery({
    queryKey: ['participation', 'admin', evenementId],
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase.rpc('evenement_participants', { p_evenement: evenementId });
      if (error) throw error;
      return data as Participant[];
    },
  });
}
