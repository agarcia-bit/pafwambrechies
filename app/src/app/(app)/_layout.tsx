import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StyleSheet, View } from 'react-native';

import { NotificationObserver } from '@/components/notification-observer';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

// Five tabs at most (Apple's guideline, and Android's limit): the less used
// sections (ideas, links, account, management) live in "Plus".
export default function AppLayout() {
  const { membership, membershipError, reloadMembership } = useSession();
  const { colors } = useTheme();

  if (!membership) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {membershipError ? <ErrorState onRetry={reloadMembership} /> : <LoadingState />}
      </View>
    );
  }
  if (!membership.profile) return <NoMembership />;

  return (
    <>
      <NotificationObserver />
      <NativeTabs tintColor={colors.primary}>
        <NativeTabs.Trigger name="(actus)">
          <NativeTabs.Trigger.Label>Actus</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'newspaper', selected: 'newspaper.fill' }} md="newspaper" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="annuaire">
          <NativeTabs.Trigger.Label>Annuaire</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="groups" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="offres">
          <NativeTabs.Trigger.Label>Offres</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'tag', selected: 'tag.fill' }} md="sell" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="agenda">
          <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="plus">
          <NativeTabs.Trigger.Label>Plus</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}

// Signed in with a login that belongs to another app of the project (e.g. Immopilot).
function NoMembership() {
  const { signOut } = useSession();
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, styles.centered, { backgroundColor: colors.background }]}>
      <Text variant="title" style={styles.center}>
        Aucune association
      </Text>
      <Text tone="secondary" style={styles.center}>
        Ce compte n’est rattaché à aucune association. Pour rejoindre la vôtre, créez un compte avec le code
        d’accès qu’elle vous a communiqué.
      </Text>
      <Button title="Se déconnecter" variant="secondary" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { justifyContent: 'center', padding: 32, gap: 16 },
  center: { textAlign: 'center' },
});
