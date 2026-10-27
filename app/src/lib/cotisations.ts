import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { daysUntil, formatDay, isoDay, todayISO } from '@/lib/format';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

// Membership dues, see supabase/cotisations.sql. A member has an end date ("valide jusqu'au");
// no row means the dues were never recorded. The bureau records renewals by hand: the payment
// itself happens on the association's own page (HelloAsso, ...), outside the app.

export type CotisationStatus = 'a_jour' | 'bientot' | 'expiree' | 'aucune';

/** Days before the end date from which a membership counts as "to renew soon". */
export const SOON_DAYS = 30;

/** A renewal recorded less than this many days before the yearly deadline covers the next year. */
const MIN_COVERAGE_DAYS = 60;

export const STATUS_LABELS: Record<CotisationStatus, string> = {
  a_jour: 'À jour',
  bientot: 'Expire bientôt',
  expiree: 'Expirée',
  aucune: 'Jamais réglée',
};

/** Badge colors, shared by the bureau list. */
export const STATUS_HUES: Record<CotisationStatus, string | undefined> = {
  a_jour: '#16A34A',
  bientot: '#D97706',
  expiree: '#DC2626',
  aucune: undefined,
};

export function cotisationStatus(validUntil: string | null | undefined): CotisationStatus {
  if (!validUntil) return 'aucune';
  const days = daysUntil(validUntil);
  if (days < 0) return 'expiree';
  return days <= SOON_DAYS ? 'bientot' : 'a_jour';
}

/** Members who should be reminded: everything but "up to date". */
export const needsRenewal = (status: CotisationStatus) => status !== 'a_jour';

/** What the member is told about their own situation. */
export function describeStatus(
  status: CotisationStatus,
  validUntil: string | null | undefined
): { title: string; message: string } {
  const end = validUntil ? formatDay(validUntil) : '';
  switch (status) {
    case 'a_jour':
      return { title: 'Cotisation à jour', message: `Votre adhésion est valable jusqu’au ${end}.` };
    case 'bientot':
      return { title: 'Cotisation à renouveler', message: `Votre adhésion se termine le ${end}.` };
    case 'expiree':
      return { title: 'Cotisation expirée', message: `Votre adhésion s’est terminée le ${end}. Pensez à la renouveler.` };
    default:
      return { title: 'Cotisation à régler', message: 'Votre cotisation n’est pas encore enregistrée par le bureau.' };
  }
}

// ── Yearly deadline ("31/08") ────────────────────────────────────────────────

/** "31/08" → { day: 31, month: 8 }; null when it is empty or not a real day of the year. */
export function parseEcheance(value: string | undefined): { day: number; month: number } | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(value?.trim() ?? '');
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(2024, month, 0).getDate()) return null;
  return { day, month };
}

/** The deadline in a given year; 29/02 falls back to the last day of February in other years. */
function deadlineIn(year: number, { day, month }: { day: number; month: number }): string {
  return isoDay(new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate())));
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return deadlineIn(y + years, { day: d, month: m });
}

/**
 * End date proposed when the bureau records a renewal: the next yearly deadline that is at least
 * two months away (a renewal a few days before the deadline covers the following year). Without
 * a configured deadline, twelve months from today.
 */
export function proposedEndDate(echeance: string | undefined): string {
  const deadline = parseEcheance(echeance);
  if (!deadline) return addYears(todayISO(), 1);
  const year = new Date().getFullYear();
  for (let y = year; y <= year + 2; y++) {
    const candidate = deadlineIn(y, deadline);
    if (daysUntil(candidate) >= MIN_COVERAGE_DAYS) return candidate;
  }
  return deadlineIn(year + 2, deadline);
}

export const followingYear = (iso: string) => addYears(iso, 1);

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
