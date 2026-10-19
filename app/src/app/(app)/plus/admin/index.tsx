import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { ListRow, ListSection } from '@/components/ui/list';
import { COLLECTIONS, COLLECTION_MODULE, withConfig } from '@/lib/admin';
import { useTenantConfig } from '@/lib/tenant-config';

export default function AdminScreen() {
  const config = useTenantConfig();
  const collections = Object.values(COLLECTIONS)
    .filter((c) => !COLLECTION_MODULE[c.key] || config.modules[COLLECTION_MODULE[c.key]!])
    .map((c) => withConfig(c, config));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ListSection title="Contenus">
        {collections.map((c) => (
          <ListRow
            key={c.key}
            icon={c.icon}
            title={c.title}
            onPress={() => router.push({ pathname: '/plus/admin/[collection]', params: { collection: c.key } })}
          />
        ))}
      </ListSection>
      {config.modules.idees && (
        <ListSection title="Modération">
          <ListRow icon="lightbulb" title="Idées" onPress={() => router.push('/plus/admin/idees')} />
        </ListSection>
      )}
      <ListSection title="Association" footer="Code d’accès, nom, couleur et logo de l’association.">
        <ListRow icon="gear" title="Réglages" onPress={() => router.push('/plus/admin/reglages')} />
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 40 },
});
