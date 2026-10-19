import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NotAllowedError } from '@/lib/admin';
import { fullName, todayISO } from '@/lib/format';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Bureau space (briefs/pilotage-bureau.md): actions and their tasks. Only
// bureau members and admins can read or write them (RLS). When an action's
// referent changes, a trigger gives it to the tasks that have no owner.

export const ACTION_STATUTS = ['À faire', 'En cours', 'Terminé', 'Bloqué'] as const;
export const TACHE_STATUTS = ['À faire', 'En cours', 'Terminé'] as const;
export const PRIORITES = ['Haute', 'Moyenne', 'Basse'] as const;

export type ActionStatut = (typeof ACTION_STATUTS)[number];
export type TacheStatut = (typeof TACHE_STATUTS)[number];
export type Priorite = (typeof PRIORITES)[number];

export type Action = {
  id: number;
  emoji: string | null;
  titre: string;
  date_action: string;
  referent: string | null;
  statut: ActionStatut;
  budget: number | null;
};

export type Tache = {
  id: number;
  action_id: number;
  libelle: string;
  responsable: string | null;
  echeance: string | null;
  statut: TacheStatut;
  priorite: Priorite;
};

/** From bureau_members(): is_bureau false = no longer in the bureau, still named somewhere. */
export type BureauMember = { id: string; prenom: string | null; nom: string | null; is_bureau: boolean };

export type BureauData = { actions: Action[]; taches: Tache[]; members: BureauMember[] };

export const DONE = 'Terminé';

export function useBureau() {
  return useQuery({
    queryKey: ['bureau'],
    queryFn: async (): Promise<BureauData> => {
      const [actions, taches, members] = await Promise.all([
        supabase.from('actions').select('id, emoji, titre, date_action, referent, statut, budget').order('date_action'),
        supabase.from('taches').select('id, action_id, libelle, responsable, echeance, statut, priorite'),
        supabase.rpc('bureau_members'),
      ]);
      if (actions.error) throw actions.error;
      if (taches.error) throw taches.error;
      if (members.error) throw members.error;
      return {
        actions: actions.data as Action[],
        taches: taches.data as Tache[],
        members: members.data as BureauMember[],
      };
    },
  });
}

export function memberName(members: BureauMember[], id: string | null): string {
  if (!id) return 'Non assigné';
  const member = members.find((m) => m.id === id);
  return member ? fullName(member.prenom, member.nom) || 'Membre' : 'Ancien membre';
}

export function isOverdue(day: string | null, statut: string): boolean {
  return !!day && statut !== DONE && day < todayISO();
}

/** Tasks of an action, soonest due first, undated last. */
export function tachesOf(taches: Tache[], actionId: number): Tache[] {
  return taches
    .filter((t) => t.action_id === actionId)
    .sort((a, b) => (a.echeance ?? '9999-12-31').localeCompare(b.echeance ?? '9999-12-31'));
}

function useInvalidateBureau() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['bureau'] });
}

export type ActionInput = Omit<Action, 'id'>;

export function useSaveAction() {
  const { profile } = useMember();
  const refresh = useInvalidateBureau();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: ActionInput }) => {
      if (id) {
        const { data, error } = await supabase.from('actions').update(values).eq('id', id).select('id');
        if (error) throw error;
        if (!data.length) throw new NotAllowedError();
        return id;
      }
      const { data, error } = await supabase
        .from('actions')
        .insert({ ...values, tenant_id: profile.tenant_id })
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: number }).id;
    },
    onSuccess: refresh,
  });
}

export function useDeleteAction() {
  const refresh = useInvalidateBureau();
  return useMutation({
    // Its tasks go with it (on delete cascade).
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export type TacheInput = Omit<Tache, 'id'>;

export function useSaveTache() {
  const { profile } = useMember();
  const refresh = useInvalidateBureau();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: number; values: TacheInput }) => {
      if (id) {
        const { data, error } = await supabase.from('taches').update(values).eq('id', id).select('id');
        if (error) throw error;
        if (!data.length) throw new NotAllowedError();
      } else {
        const { error } = await supabase.from('taches').insert({ ...values, tenant_id: profile.tenant_id });
        if (error) throw error;
      }
    },
    onSuccess: refresh,
  });
}

export function useDeleteTache() {
  const refresh = useInvalidateBureau();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('taches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

/** Ticks / unticks a task, shown at once and rolled back if the save fails. */
export function useToggleTache() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const { error } = await supabase
        .from('taches')
        .update({ statut: done ? DONE : 'À faire' })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, done }) => {
      await client.cancelQueries({ queryKey: ['bureau'] });
      const previous = client.getQueryData<BureauData>(['bureau']);
      if (previous) {
        client.setQueryData<BureauData>(['bureau'], {
          ...previous,
          taches: previous.taches.map((t) => (t.id === id ? { ...t, statut: done ? DONE : 'À faire' } : t)),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(['bureau'], context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['bureau'] }),
  });
}
