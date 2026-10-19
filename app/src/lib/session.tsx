import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { forgetPush, syncPush } from '@/lib/notifications';
import { cancelAllReminders } from '@/lib/poll-reminders';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import type { Branding, Profile } from '@/lib/types';

// A signed-in account without a profile is not an association member
// (the login is shared with other apps on the same Supabase project).
export type Membership = { profile: Profile | null; branding: Branding | null };

type SessionContextValue = {
  session: Session | null;
  /** Restoring the stored session at launch. */
  isLoading: boolean;
  /** Signed in through a password reset link: a new password must be chosen. */
  recovery: boolean;
  endRecovery: () => void;
  membership: Membership | undefined;
  membershipError: boolean;
  reloadMembership: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** Profile and branding of the member, for screens that are only reachable once they are loaded. */
export function useMember(): { profile: Profile; branding: Branding | null; isAdmin: boolean; isBureau: boolean } {
  const { membership } = useSession();
  const profile = membership?.profile;
  if (!profile) throw new Error('useMember used before the membership was loaded');
  return {
    profile,
    branding: membership.branding,
    isAdmin: profile.role === 'admin',
    // Admins also run the bureau space, as in the web app.
    isBureau: profile.role === 'bureau' || profile.role === 'admin',
  };
}

async function fetchMembership(userId: string): Promise<Membership> {
  const [profile, branding] = await Promise.all([
    supabase.from('profiles').select('id, email, prenom, nom, role, tenant_id').eq('id', userId).maybeSingle(),
    supabase.rpc('get_my_branding'),
  ]);
  if (profile.error) throw profile.error;
  if (branding.error) throw branding.error;
  return { profile: profile.data as Profile | null, branding: branding.data as Branding | null };
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') {
        setRecovery(false);
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const membershipQuery = useQuery({
    queryKey: ['membership', userId],
    queryFn: () => fetchMembership(userId!),
    enabled: !!userId,
  });
  const memberId = membershipQuery.data?.profile?.id;

  // Keep this phone's push token attached to the member who is signed in.
  useEffect(() => {
    if (memberId) syncPush().catch(() => {});
  }, [memberId]);

  async function signOut() {
    await forgetPush().catch(() => {});
    await cancelAllReminders(membershipQuery.data?.profile?.id).catch(() => {});
    // 'local': the login is shared with other apps, their sessions stay open.
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <SessionContext
      value={{
        session,
        isLoading,
        recovery,
        endRecovery: () => setRecovery(false),
        membership: userId ? membershipQuery.data : undefined,
        membershipError: membershipQuery.isError,
        reloadMembership: () => membershipQuery.refetch(),
        signOut,
      }}>
      {children}
    </SessionContext>
  );
}
