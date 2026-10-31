import { router } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { BandPill, BrandBand } from '@/components/brand-band';
import { AssociationBanner, associationName } from '@/components/association';
import { CoachTarget, useCoachReveal } from '@/components/coach-target';
import { CotisationRow } from '@/components/cotisation-banner';
import { ListRow, ListSection } from '@/components/ui/list';
import { fullName } from '@/lib/format';
import { openTour } from '@/lib/tour';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { useBandListStyle } from '@/theme';

export default function PlusScreen() {
  const { profile, isBureau, isPlatformAdmin, branding } = useMember();
  const { modules } = useTenantConfig();
  const scroll = useRef<ScrollViewInstance>(null);
  // Guided tour: its stops in this screen are near the bottom.
  useCoachReveal(['plus-fiche', 'plus-idees', 'plus-tour'], () => scroll.current?.scrollToEnd({ animated: true }));
  const bandStyle = useBandListStyle();
  return (
    <ScrollView ref={scroll} style={bandStyle} contentInsetAdjustmentBehavior="never">
      <BrandBand title="Plus" subtitle="Mon espace">
        <BandPill label={associationName(branding)} />
      </BrandBand>
      <View style={styles.content}>
      <AssociationBanner />
      {isPlatformAdmin && (
        <ListSection title="Plateforme">
          <ListRow
            icon="people"
            title="Changer d’association"
            value={associationName(branding)}
            onPress={() => router.push('/plus/associations')}
          />
        </ListSection>
      )}
      {(modules.idees || modules.liens || modules.documents) && (
        <ListSection title="Communauté">
          {modules.idees && (
            <CoachTarget id="plus-idees">
              <ListRow icon="lightbulb" title="Boîte à idées" onPress={() => router.push('/plus/idees')} />
            </CoachTarget>
          )}
          {modules.documents && (
            <ListRow icon="document" title="Documents" onPress={() => router.push('/plus/documents')} />
          )}
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
          <CoachTarget id="plus-fiche">
            <ListRow
              icon="people"
              title="Ma fiche annuaire"
              subtitle="Photo, coordonnées, description"
              onPress={() => router.push('/plus/ma-fiche')}
            />
          </CoachTarget>
        )}
        {modules.offres && (
          <ListRow
            icon="tag"
            title="Mes offres"
            subtitle="Proposer une offre aux adhérents"
            onPress={() => router.push('/plus/mes-offres')}
          />
        )}
        <CotisationRow />
        <ListRow
          icon="person"
          title="Mon compte"
          subtitle={fullName(profile.prenom, profile.nom) || profile.email || undefined}
          onPress={() => router.push('/plus/compte')}
        />
        <CoachTarget id="plus-tour">
          <ListRow icon="info" title="Visite guidée" subtitle="Revoir la présentation de l’application" onPress={openTour} />
        </CoachTarget>
      </ListSection>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 20, gap: 24, paddingBottom: 40 },
});
