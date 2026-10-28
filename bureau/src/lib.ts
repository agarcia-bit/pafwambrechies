import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

// Valeurs publiques (identiques à l'app) : la clé publiable n'ouvre que ce que les règles RLS autorisent.
export const supabase = createClient(
  'https://ancwbfyjzaebxahtlqkm.supabase.co',
  'sb_publishable_jCDrtwqzqjbsq0NEIwUbPQ_EFeoFaDh'
);

export type Role = 'adherent' | 'bureau' | 'admin';
export type Profile = { id: string; prenom: string | null; nom: string | null; email: string | null; role: Role; tenant_id: string };

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => live && setState({ error: e?.message ?? 'Erreur', loading: false })
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export const fullName = (p: { prenom?: string | null; nom?: string | null; email?: string | null }) =>
  [p.prenom, p.nom].filter(Boolean).join(' ') || p.email || '—';

export const today = () => new Date().toISOString().slice(0, 10);
export const formatDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const daysUntil = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000);

export type CotisStatus = 'a_jour' | 'expiree' | 'aucune';
export const cotisStatus = (validUntil: string | null): CotisStatus =>
  !validUntil ? 'aucune' : daysUntil(validUntil) < 0 ? 'expiree' : 'a_jour';
export const STATUS_LABEL: Record<CotisStatus, string> = { a_jour: 'À jour', expiree: 'Expirée', aucune: 'Jamais réglée' };

export function mailto(bcc: string[], subject: string, body: string) {
  return `mailto:?bcc=${bcc.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type MemberRow = {
  key: string;
  id: string | null;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  role: Role | null;
  valide_jusqu: string | null;
  inscrit: boolean;
};

/** Adhérents inscrits + adhérents importés qui n'ont pas encore de compte. */
export async function loadMembers(): Promise<MemberRow[]> {
  const [cot, inv] = await Promise.all([
    supabase.rpc('list_cotisations'),
    supabase.from('adherents_invites').select('email, prenom, nom, valide_jusqu, user_id'),
  ]);
  if (cot.error) throw cot.error;
  if (inv.error) throw inv.error;
  const joined: MemberRow[] = (cot.data as any[]).map((m) => ({
    key: m.id, id: m.id, prenom: m.prenom, nom: m.nom, email: m.email, role: m.role, valide_jusqu: m.valide_jusqu, inscrit: true,
  }));
  const waiting: MemberRow[] = (inv.data as any[])
    .filter((i) => !i.user_id)
    .map((i) => ({ key: 'i:' + i.email, id: null, prenom: i.prenom, nom: i.nom, email: i.email, role: null, valide_jusqu: i.valide_jusqu, inscrit: false }));
  return [...joined, ...waiting];
}
