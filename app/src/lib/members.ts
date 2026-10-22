import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

export type MemberRow = { id: string; email: string | null; prenom: string | null; nom: string | null; role: Role };

export const ROLE_LABELS: Record<Role, string> = { adherent: 'Adhérent', bureau: 'Bureau', admin: 'Administrateur' };

const ROLE_ORDER: Record<Role, number> = { admin: 0, bureau: 1, adherent: 2 };

/** Every member of the association (the profiles policy only lets admins read them all). */
export function useMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase.from('profiles').select('id, email, prenom, nom, role');
      if (error) throw error;
      return (data as MemberRow[]).sort(
        (a, b) =>
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
          `${a.prenom ?? ''} ${a.nom ?? ''}`.localeCompare(`${b.prenom ?? ''} ${b.nom ?? ''}`, 'fr')
      );
    },
  });
}

/** Admin only: the database refuses anyone else, and refuses changing one's own role. */
export function useSetMemberRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: Role }) => {
      const { error } = await supabase.rpc('set_member_role', { p_member: memberId, p_role: role });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['admin', 'members'] }),
  });
}
