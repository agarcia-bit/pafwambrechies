import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APP_DOWNLOAD_URL } from '@/lib/config';
import type { ImportRow } from '@/lib/import-adherents';
import { supabase } from '@/lib/supabase';

// Members imported by the bureau (supabase/adherents_import.sql). Someone on the list who creates
// their account with the association's code and the same e-mail is linked to their row.

export type Invite = {
  email: string;
  prenom: string | null;
  nom: string | null;
  valide_jusqu: string | null;
  created_at: string;
  user_id: string | null;
  joined_at: string | null;
};

export type ImportResult = { invites: number; deja_inscrits: number; cotisations: number; ignores: number };

export function useInvitations() {
  return useQuery({
    queryKey: ['admin', 'invitations'],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('adherents_invites')
        .select('email, prenom, nom, valide_jusqu, created_at, user_id, joined_at')
        .order('created_at', { ascending: false })
        .order('email');
      if (error) throw error;
      return data as Invite[];
    },
  });
}

function useRefreshInvitations() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'invitations'] }),
      // An import can also update the dues of members who already have an account.
      client.invalidateQueries({ queryKey: ['admin', 'cotisations'] }),
      client.invalidateQueries({ queryKey: ['cotisation'] }),
    ]);
}

export function useImportAdherents() {
  const refresh = useRefreshInvitations();
  return useMutation({
    mutationFn: async (rows: ImportRow[]): Promise<ImportResult> => {
      const { data, error } = await supabase.rpc('importer_adherents', { p_rows: rows });
      if (error) throw error;
      return data as ImportResult;
    },
    onSettled: refresh,
  });
}

export function useRemoveInvitation() {
  const refresh = useRefreshInvitations();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc('retirer_invitation', { p_email: email });
      if (error) throw error;
    },
    onSettled: refresh,
  });
}

/** The association's access code, for the invitation message (bureau and admins). */
export function useSignupCode() {
  return useQuery({
    queryKey: ['admin', 'signup-code'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('get_signup_code');
      if (error) throw error;
      return (data as string | null) || null;
    },
    retry: false,
  });
}

/** The message the bureau sends to the members who have not joined yet. */
export function invitationMessage(associationName: string, code: string | null): { subject: string; body: string } {
  const steps = [
    APP_DOWNLOAD_URL ? `Installez l’application Allianceo : ${APP_DOWNLOAD_URL}` : 'Installez l’application Allianceo sur votre téléphone.',
    code
      ? `Touchez « Créer un compte » et saisissez le code d’accès : ${code}`
      : 'Touchez « Créer un compte » et saisissez le code d’accès que le bureau vous a communiqué.',
    'Utilisez l’adresse e-mail où vous recevez ce message : votre adhésion sera retrouvée automatiquement.',
  ];
  return {
    subject: `Rejoignez ${associationName} sur Allianceo`,
    body: [
      'Bonjour,',
      '',
      `${associationName} utilise l’application Allianceo pour partager ses actus, son agenda et ses offres.`,
      '',
      ...steps.map((step, i) => `${i + 1}. ${step}`),
      '',
      'À bientôt !',
    ].join('\n'),
  };
}

export type SendResult = { sent: number; failed: number; failed_emails?: string[] };

/**
 * Sends the invitation through the platform (send-mail function, Resend): under the association's
 * name, one message per person, replies going to the sender. 'unavailable' when direct sending is
 * not set up or fails entirely: the caller then offers the phone's mail app.
 */
export async function sendInvitationMail(
  emails: string[],
  message: { subject: string; body: string }
): Promise<SendResult | 'unavailable'> {
  const { data, error } = await supabase.functions.invoke('send-mail', {
    body: { destinataires: emails.map((email) => ({ email })), sujet: message.subject, corps: message.body },
  });
  if (error) return 'unavailable';
  return data as SendResult;
}
