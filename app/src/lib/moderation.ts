import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Platform } from 'react-native';

import { showMessage } from '@/lib/confirm';
import { useMember } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Reporting and blocking (supabase/moderation.sql), required by the App Store for apps where
// members publish content: report what is inappropriate, block someone, and the bureau acts.

export type ReportKind = 'actus_commentaire' | 'idee' | 'idee_commentaire' | 'offre' | 'annuaire';

export const KIND_LABELS: Record<ReportKind, string> = {
  actus_commentaire: 'Commentaire sur une actu',
  idee_commentaire: 'Commentaire sur une idée',
  idee: 'Idée',
  offre: 'Offre',
  annuaire: 'Fiche annuaire',
};

/** Table of each kind, to delete the reported content. */
export const KIND_TABLES: Record<ReportKind, string> = {
  actus_commentaire: 'actus_commentaires',
  idee_commentaire: 'idees_commentaires',
  idee: 'idees',
  offre: 'offres',
  annuaire: 'annuaire',
};

const REASONS = ['Contenu inapproprié ou offensant', 'Spam ou publicité', 'Autre problème'];

export type Blocked = { blocked_id: string; nom: string | null };

/** The members the signed-in member has blocked. */
export function useBlocked() {
  const { profile } = useMember();
  return useQuery({
    queryKey: ['blocages', profile.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('blocages').select('blocked_id, nom').order('created_at');
      if (error) throw error;
      return data as Blocked[];
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** Ids of the blocked members, to hide what they publish. Empty while loading or unavailable. */
export function useBlockedIds(): Set<string> {
  const { data } = useBlocked();
  return new Set((data ?? []).map((b) => b.blocked_id));
}

export function useUnblock() {
  const { profile } = useMember();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase.from('blocages').delete().eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['blocages', profile.id] }),
  });
}

function useBlock() {
  const { profile } = useMember();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string | null }) => {
      const { error } = await supabase
        .from('blocages')
        .upsert({ blocker_id: profile.id, blocked_id: userId, tenant_id: profile.tenant_id, nom: name });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['blocages', profile.id] }),
  });
}

function useReport() {
  const { profile } = useMember();
  return useMutation({
    mutationFn: async ({ kind, targetId, reason }: { kind: ReportKind; targetId: number; reason: string }) => {
      const { error } = await supabase
        .from('signalements')
        .insert({ tenant_id: profile.tenant_id, reporter_id: profile.id, kind, target_id: targetId, reason });
      // Already reported by this member: the report exists.
      if (error && error.code !== '23505') throw error;
    },
  });
}

export type ReportTarget = {
  kind: ReportKind;
  targetId: number;
  /** Author of the content (null if unknown: only reporting is offered). */
  authorId: string | null;
  authorName: string | null;
};

/** The menu "Signaler / Bloquer" of a piece of content written by someone else. */
export function useContentMenu() {
  const { profile } = useMember();
  const report = useReport();
  const block = useBlock();

  function sendReport(target: ReportTarget, reason: string) {
    report.mutate(
      { kind: target.kind, targetId: target.targetId, reason },
      {
        onSuccess: () =>
          showMessage('Merci', 'Votre signalement a été transmis au bureau de l’association, qui l’examinera rapidement.'),
        onError: () => showMessage('Signalement non envoyé', 'Vérifiez votre connexion et réessayez.'),
      }
    );
  }

  function chooseReason(target: ReportTarget) {
    if (Platform.OS === 'web') {
      sendReport(target, REASONS[0]);
      return;
    }
    Alert.alert('Pourquoi signalez-vous ce contenu ?', undefined, [
      ...REASONS.map((reason) => ({ text: reason, onPress: () => sendReport(target, reason) })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }

  function confirmBlock(target: ReportTarget) {
    if (!target.authorId) return;
    const name = target.authorName || 'ce membre';
    Alert.alert(`Bloquer ${name} ?`, 'Vous ne verrez plus ses commentaires, idées, offres ni sa fiche. Vous pourrez le débloquer dans Mon compte.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer',
        style: 'destructive',
        onPress: () =>
          block.mutate(
            { userId: target.authorId!, name: target.authorName },
            { onError: () => showMessage('Blocage impossible', 'Vérifiez votre connexion et réessayez.') }
          ),
      },
    ]);
  }

  return function open(target: ReportTarget) {
    if (target.authorId === profile.id) return;
    const canBlock = !!target.authorId;
    if (Platform.OS === 'web') {
      chooseReason(target);
      return;
    }
    Alert.alert('Ce contenu pose problème ?', undefined, [
      { text: 'Signaler ce contenu', onPress: () => chooseReason(target) },
      ...(canBlock ? [{ text: 'Bloquer ce membre', style: 'destructive' as const, onPress: () => confirmBlock(target) }] : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };
}

// ── For the bureau ───────────────────────────────────────────────────────────

export type PendingReport = {
  id: number;
  kind: ReportKind;
  target_id: number;
  reason: string;
  created_at: string;
  reporter_nom: string | null;
  contenu: string | null;
  auteur_id: string | null;
  auteur_nom: string | null;
};

export function usePendingReports() {
  return useQuery({
    queryKey: ['signalements'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('signalements_a_traiter');
      if (error) throw error;
      return data as PendingReport[];
    },
    retry: false,
  });
}

/** Closes a report, and deletes the reported content when `remove` is set. */
export function useHandleReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ report, remove }: { report: PendingReport; remove: boolean }) => {
      if (remove) {
        const { error } = await supabase.from(KIND_TABLES[report.kind]).delete().eq('id', report.target_id);
        if (error) throw error;
      }
      const { error } = await supabase.from('signalements').update({ traite: true }).eq('id', report.id);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all(
        ['signalements', 'comments', 'idees', 'annuaire', 'offres', 'mes-offres', 'ma-fiche', 'admin'].map((key) =>
          client.invalidateQueries({ queryKey: [key] })
        )
      ),
  });
}
