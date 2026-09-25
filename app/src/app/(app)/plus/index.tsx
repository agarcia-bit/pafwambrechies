import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AssociationBanner } from '@/components/association';
import { ListRow, ListSection } from '@/components/ui/list';
import { fullName } from '@/lib/format';
import { useMember } from '@/lib/session';

export default function PlusScreen() {
  const { profile } = useMember();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <AssociationBanner />
      <ListSection title="Communauté">
        <ListRow icon="lightbulb" title="Boîte à idées" onPress={() => router.push('/plus/idees')} />
        <ListRow icon="link" title="Liens utiles" onPress={() => router.push('/plus/liens')} />
      </ListSection>
      <ListSection>
        <ListRow
          icon="person"
          title="Mon compte"
          subtitle={fullName(profile.prenom, profile.nom) || profile.email || undefined}
          onPress={() => router.push('/plus/compte')}
        />
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 40 },
});
