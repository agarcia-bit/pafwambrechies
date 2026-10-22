import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { usePlatformTenants, useSwitchTenant } from '@/lib/platform';
import { useSession } from '@/lib/session';

// Reserved to the platform owner: look at (and administer) another association.
export default function AssociationsScreen() {
  const tenants = usePlatformTenants();
  const { reloadMembership } = useSession();
  const switchTenant = useSwitchTenant(reloadMembership);

  if (tenants.isPending) return <LoadingState />;
  if (tenants.isError) return <ErrorState onRetry={tenants.refetch} />;
  if (!tenants.data.length) return <EmptyState title="Aucune association" />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text tone="secondary" style={styles.intro}>
        Vous administrez toutes les associations. Choisissez celle que vous voulez voir : l’app prend ses couleurs et
        ses contenus.
      </Text>
      <ListSection>
        {tenants.data.map((t) => (
          <ListRow
            key={t.id}
            icon={t.is_current ? 'checkCircle' : 'circle'}
            title={t.name}
            subtitle={t.is_current ? 'Association affichée' : undefined}
            hideChevron
            selected={t.is_current}
            onPress={() => {
              if (t.is_current) return router.back();
              switchTenant.mutate(t.slug, {
                onSuccess: () => router.dismissTo('/'),
                onError: () => showMessage('Changement impossible', 'Vérifiez votre connexion et réessayez.'),
              });
            }}
          />
        ))}
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  intro: { marginHorizontal: 4 },
});
