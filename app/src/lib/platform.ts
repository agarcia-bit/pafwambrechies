import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { syncPush } from '@/lib/notifications';

// The platform owner's associations and the switch between them (supabase/platform_admin.sql).

export type PlatformTenant = { id: string; slug: string; name: string; is_current: boolean };

export function usePlatformTenants(enabled = true) {
  return useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_my_tenants');
      if (error) throw error;
      return data as PlatformTenant[];
    },
    enabled,
    retry: false,
  });
}

/** Looks at another association: everything loaded for the previous one is dropped. */
export function useSwitchTenant(reloadMembership: () => void) {
  return useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase.rpc('switch_tenant', { p_slug: slug });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'membership' });
      reloadMembership();
      syncPush().catch(() => {});
    },
  });
}
