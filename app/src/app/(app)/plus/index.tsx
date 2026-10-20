import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BrandBand } from '@/components/brand-band';
import { AssociationBanner } from '@/components/association';
import { ListRow, ListSection } from '@/components/ui/list';
import { fullName } from '@/lib/format';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { useBandListStyle } from '@/theme';

export default function PlusScreen() {
  const { profile, isBureau } = useMember();
  const { modules } = useTenantConfig();
  const bandStyle = useBandListStyle();
  return (
    <ScrollView style={bandStyle} contentInsetAdjustmentBehavior="never">
      <BrandBand title="Plus" />
      <View style={styles.content}>
      <AssociationBanner />
      {(modules.idees || modules.liens) && (
        <ListSection title="Communauté">
          {modules.idees && <ListRow icon="lightbulb" title="Boîte à idées" onPress={() => router.push('/plus/idees')} />}
          {modules.liens && <ListRow icon="link" title="Liens utiles" onPress={() => router.push('/plus/liens')} />}
        </ListSection>
      )}
      {isBureau && (
        <ListSection title="Gestion">
          <ListRow
            icon="clipboard"
            title="Pilotage bureau"
            subtitle="Actions et tâches du bureau"
            onPress={() => router.push('/plus/bureau')}
          />
          <ListRow
              icon="shield"
              title="Administration"
              subtitle="Actus, offres, agenda, annuaire, sondages"
              onPress={() => router.push('/plus/admin')}
            />
        </ListSection>
      )}
      <ListSection>
        {modules.annuaire && (
          <ListRow
            icon="people"
            title="Ma fiche annuaire"
            subtitle="Photo, coordonnées, description"
            onPress={() => router.push('/plus/ma-fiche')}
          />
        )}
        {modules.offres && (
          <ListRow
            icon="tag"
            title="Mes offres"
            subtitle="Proposer une offre aux adhérents"
            onPress={() => router.push('/plus/mes-offres')}
          />
        )}
        <ListRow
          icon="person"
          title="Mon compte"
          subtitle={fullName(profile.prenom, profile.nom) || profile.email || undefined}
          onPress={() => router.push('/plus/compte')}
        />
      </ListSection>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 20, gap: 24, paddingBottom: 40 },
});
