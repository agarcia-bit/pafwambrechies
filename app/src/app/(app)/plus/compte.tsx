import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { associationName } from '@/components/association';
import { Avatar } from '@/components/ui/avatar';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { PRIVACY_POLICY_URL } from '@/lib/config';
import { confirmAction, showMessage } from '@/lib/confirm';
import { usePushStatus } from '@/lib/data';
import { fullName } from '@/lib/format';
import { openLink } from '@/lib/links';
import { disablePush, enablePush, type PushStatus } from '@/lib/notifications';
import { useMember, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';
import { useTheme } from '@/theme';

const ROLE_LABELS: Record<Role, string> = {
  adherent: 'Adhérent',
  bureau: 'Membre du bureau',
  admin: 'Administrateur',
};

function pushFooter(status: PushStatus | undefined): string {
  if (status === 'unavailable') return 'Les notifications ne sont pas disponibles sur cet appareil.';
  if (status === 'denied') return 'Les notifications sont bloquées pour Allianceo : autorisez-les dans les Réglages.';
  return 'Une notification à chaque nouvelle actu de votre association.';
}

export default function CompteScreen() {
  const { profile, branding } = useMember();
  const { signOut } = useSession();
  const { colors } = useTheme();
  const client = useQueryClient();
  const push = usePushStatus();
  const [pushBusy, setPushBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const name = fullName(profile.prenom, profile.nom);

  async function togglePush(on: boolean) {
    setPushBusy(true);
    try {
      if (!on) await disablePush();
      else if ((await enablePush()) === 'denied') {
        showMessage('Notifications bloquées', 'Autorisez les notifications pour Allianceo dans les Réglages.');
      }
    } catch {
      showMessage('Action impossible', 'Vérifiez votre connexion et réessayez.');
    }
    setPushBusy(false);
    client.invalidateQueries({ queryKey: ['push-status'] });
  }

  async function confirmSignOut() {
    if (await confirmAction({ title: 'Se déconnecter ?', confirmLabel: 'Se déconnecter' })) await signOut();
  }

  // Required by Apple for apps with account creation.
  async function deleteAccount() {
    const ok = await confirmAction({
      title: 'Supprimer mon compte ?',
      message:
        'Votre profil, vos idées, vos commentaires et vos « j’aime » seront définitivement supprimés. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      setDeleting(false);
      showMessage('Suppression impossible', 'Vérifiez votre connexion et réessayez.');
      return;
    }
    showMessage('Compte supprimé', 'Vos données ont été effacées.');
    await signOut();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Avatar name={name || profile.email} size={72} round />
        <Text variant="title">{name || 'Mon compte'}</Text>
        {!!profile.email && <Text tone="secondary">{profile.email}</Text>}
      </View>

      <ListSection title="Association">
        <ListRow icon="people" title={associationName(branding)} />
        {profile.role !== 'adherent' && <ListRow icon="hand" title="Rôle" value={ROLE_LABELS[profile.role]} />}
      </ListSection>

      <ListSection title="Notifications" footer={pushFooter(push.data)}>
        <ListRow
          icon="bell"
          title="Nouvelles actus"
          right={
            <Switch
              accessibilityLabel="Notifications des nouvelles actus"
              value={push.data === 'enabled'}
              disabled={pushBusy || !push.data || push.data === 'unavailable'}
              onValueChange={togglePush}
              trackColor={{ true: colors.primary }}
            />
          }
        />
        {push.data === 'denied' && <ListRow icon="info" title="Ouvrir les Réglages" onPress={() => Linking.openSettings()} />}
      </ListSection>

      <ListSection>
        <ListRow icon="lock" title="Politique de confidentialité" onPress={() => openLink(PRIVACY_POLICY_URL)} />
      </ListSection>

      <ListSection>
        <ListRow icon="logout" title="Se déconnecter" destructive onPress={confirmSignOut} />
      </ListSection>

      <ListSection footer="Supprime votre compte et vos contributions (idées, commentaires, « j’aime »).">
        <ListRow
          icon="trash"
          title={deleting ? 'Suppression…' : 'Supprimer mon compte'}
          destructive
          onPress={deleting ? undefined : deleteAccount}
        />
      </ListSection>

      <Text variant="caption" tone="secondary" style={styles.version}>
        Allianceo {Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  head: { alignItems: 'center', gap: 6 },
  version: { textAlign: 'center' },
});
