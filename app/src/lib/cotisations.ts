import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { daysUntil, formatDay, isoDay, todayISO } from '@/lib/format';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

// Membership dues, see supabase/cotisations.sql. A member has an end date ("valide jusqu'au");
// no row means the dues were never recorded. The bureau records renewals by hand: the payment
// itself happens on the association's own page (HelloAsso, ...), outside the app.

/**
 * 'aucune': nothing recorded; 'expiree': ended; 'a_renouveler': still valid but the open
 * renewal campaign asks for a later end date; 'a_jour': nothing to do.
 */
export type CotisationStatus = 'a_jour' | 'a_renouveler' | 'expiree' | 'aucune';

export const STATUS_LABELS: Record<CotisationStatus, string> = {
  a_jour: 'À jour',
  a_renouveler: 'À renouveler',
  expiree: 'Expirée',
  aucune: 'Jamais réglée',
};

/** Badge colors, shared by the bureau list. */
export const STATUS_HUES: Record<CotisationStatus, string | undefined> = {
  a_jour: '#16A34A',
  a_renouveler: '#D97706',
  expiree: '#DC2626',
  aucune: undefined,
};

/**
 * The bureau's renewal campaign: from `ouverture`, the membership `libelle` (e.g. "2027") is
 * due, valid until `fin`. Both dates are "YYYY-MM-DD"; without them there is no campaign.
 */
export type Campaign = { ouverture: string; fin: string; libelle: string };

/** Campaign of the association, or null when none is set (or it is over). */
export function campaignOf(config: { ouverture: string; fin: string; libelle: string }): Campaign | null {
  const { ouverture, fin, libelle } = config;
  if (!ouverture || !fin || daysUntil(fin) < 0) return null;
  return { ouverture, fin, libelle };
}

/** The campaign has started: members are now asked to renew. */
export const campaignOpen = (campaign: Campaign | null): boolean => !!campaign && daysUntil(campaign.ouverture) <= 0;

export function cotisationStatus(
  validUntil: string | null | undefined,
  campaign: Campaign | null = null
): CotisationStatus {
  if (!validUntil) return 'aucune';
  if (daysUntil(validUntil) < 0) return 'expiree';
  return campaign && campaignOpen(campaign) && validUntil < campaign.fin ? 'a_renouveler' : 'a_jour';
}

/** Whether the member has something to do (shown in the bureau list). */
export const needsRenewal = (status: CotisationStatus) => status !== 'a_jour';

/** What the member is told about their own situation. */
export function describeStatus(
  status: CotisationStatus,
  validUntil: string | null | undefined,
  campaign: Campaign | null = null
): { title: string; message: string } {
  const end = validUntil ? formatDay(validUntil) : '';
  const name = campaign && campaignOpen(campaign) && campaign.libelle ? ` ${campaign.libelle}` : '';
  switch (status) {
    case 'a_jour':
      return { title: 'Cotisation à jour', message: `Votre adhésion est valable jusqu’au ${end}.` };
    case 'a_renouveler':
      return {
        title: `Cotisation${name} à renouveler`,
        message: `Votre adhésion actuelle est valable jusqu’au ${end}. Le renouvellement est ouvert.`,
      };
    case 'expiree':
      return { title: `Cotisation${name} à renouveler`, message: `Votre adhésion s’est terminée le ${end}.` };
    default:
      return { title: `Cotisation${name} à régler`, message: 'Votre cotisation n’est pas encore enregistrée par le bureau.' };
  }
}

function addOneYear(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y + 1, m - 1, Math.min(d, new Date(y + 1, m, 0).getDate())));
}

/**
 * End date proposed when the bureau records a renewal: the campaign's end date, or twelve
 * months from today when there is no campaign.
 */
export function proposedEndDate(campaign: Campaign | null): string {
  return campaign ? campaign.fin : addOneYear(todayISO());
}

// ── Data ─────────────────────────────────────────────────────────────────────

/** The member's own end date (null: nothing recorded). */
export function useMyCotisation() {
  const { profile } = useMember();
  return useQuery({
    queryKey: ['cotisation', profile.tenant_id, profile.id],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('cotisations')
        .select('valide_jusqu')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.valide_jusqu as string | undefined) ?? null;
    },
  });
}

export type CotisationRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  role: Role;
  valide_jusqu: string | null;
};

/** Every member of the association with their end date (bureau and admins only). */
export function useCotisations() {
  const { profile } = useMember();
  return useQuery({
    queryKey: ['admin', 'cotisations', profile.tenant_id],
    queryFn: async (): Promise<CotisationRow[]> => {
      const { data, error } = await supabase.rpc('list_cotisations');
      if (error) throw error;
      return data as CotisationRow[];
    },
  });
}

function useRefreshCotisations() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'cotisations'] }),
      client.invalidateQueries({ queryKey: ['cotisation'] }),
    ]);
}

export function useSetCotisation() {
  const refresh = useRefreshCotisations();
  return useMutation({
    mutationFn: async ({ memberId, validUntil }: { memberId: string; validUntil: string }) => {
      const { error } = await supabase.rpc('set_cotisation', { p_member: memberId, p_valide_jusqu: validUntil });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export function useClearCotisation() {
  const refresh = useRefreshCotisations();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc('clear_cotisation', { p_member: memberId });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

export type CotisationSettings = { url: string; montant: string; libelle: string; ouverture: string; fin: string };

/** Payment link, amount and renewal campaign: the bureau sets them (not only the admins). */
export function useSaveCotisationSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (s: CotisationSettings) => {
      const { error } = await supabase.rpc('save_cotisation_settings', {
        p_url: s.url.trim(),
        p_montant: s.montant.trim(),
        p_libelle: s.libelle.trim(),
        p_ouverture: s.ouverture || null,
        p_fin: s.fin || null,
      });
      if (error) throw error;
    },
    // The membership query carries the branding: every screen picks the new settings up.
    onSuccess: () => client.invalidateQueries({ queryKey: ['membership'] }),
  });
}
