import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BandPill, BrandBand } from '@/components/brand-band';
import { AssociationBanner, associationName } from '@/components/association';
import { CotisationRow } from '@/components/cotisation-banner';
import { Avatar } from '@/components/ui/avatar';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { fullName } from '@/lib/format';
import { openTour } from '@/lib/tour';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { useBandListStyle, useTheme } from '@/theme';

// Three kinds of things, kept apart: what the association offers beyond the tabs ("Communauté",
// in its color), the member's own settings ("Mon espace", in grey, opened by their name), and the
// bureau's tools, on a dark block of their own that only the bureau and the admins see.
export default function PlusScreen() {
  const { profile, isBureau, isPlatformAdmin, branding } = useMember();
  const { modules } = useTenantConfig();
  const bandStyle = useBandListStyle();
  const name = fullName(profile.prenom, profile.nom) || profile.email || 'Mon compte';
  return (
    <ScrollView style={bandStyle} contentInsetAdjustmentBehavior="never">
      <BrandBand title="Plus" subtitle="Mon espace">
        <BandPill label={associationName(branding)} />
      </BrandBand>
      <View style={styles.content}>
        <AssociationBanner />

        {(modules.idees || modules.liens || modules.documents) && (
          <ListSection title="Communauté">
            {modules.idees && (
              <ListRow
                icon="lightbulb"
                title="Boîte à idées"
                subtitle="Proposer, soutenir et commenter des idées"
                onPress={() => router.push('/plus/idees')}
              />
            )}
            {modules.documents && (
              <ListRow
                icon="document"
                title="Documents"
                subtitle="Statuts, comptes rendus, règlements…"
                onPress={() => router.push('/plus/documents')}
              />
            )}
            {modules.liens && (
              <ListRow
                icon="link"
                title="Liens utiles"
                subtitle="Les sites de l’association"
                onPress={() => router.push('/plus/liens')}
              />
            )}
          </ListSection>
        )}

        <ListSection title="Mon espace">
          <ProfileRow name={name} onPress={() => router.push('/plus/compte')} />
          {modules.annuaire && (
            <ListRow
              neutral
              icon="people"
              title="Ma fiche annuaire"
              subtitle="Photo, coordonnées, description"
              onPress={() => router.push('/plus/ma-fiche')}
            />
          )}
          {modules.offres && (
            <ListRow
              neutral
              icon="tag"
              title="Mes offres"
              subtitle="Proposer une offre aux adhérents"
              onPress={() => router.push('/plus/mes-offres')}
            />
          )}
          <CotisationRow />
          <ListRow neutral icon="info" title="Visite guidée" subtitle="Revoir la présentation de l’application" onPress={openTour} />
        </ListSection>

        {(isBureau || isPlatformAdmin) && (
          <BureauBlock>
            {isBureau && (
              <>
                <BureauRow
                  icon="clipboard"
                  title="Pilotage bureau"
                  subtitle="Actions et tâches du bureau"
                  onPress={() => router.push('/plus/bureau')}
                />
                <BureauRow
                  icon="shield"
                  title="Administration"
                  subtitle="Actus, offres, agenda, annuaire, sondages"
                  onPress={() => router.push('/plus/admin')}
                />
              </>
            )}
            {isPlatformAdmin && (
              <BureauRow
                icon="people"
                title="Changer d’association"
                subtitle={associationName(branding)}
                onPress={() => router.push('/plus/associations')}
              />
            )}
          </BureauBlock>
        )}
      </View>
    </ScrollView>
  );
}

/** First row of "Mon espace": the member, like the account card of the phone's settings. */
function ProfileRow({ name, onPress }: { name: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mon compte, ${name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.profile, pressed && { backgroundColor: colors.fill }]}>
      <Avatar name={name} size={46} round />
      <View style={styles.flex}>
        <Text variant="headline">{name}</Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          Mon compte et notifications
        </Text>
      </View>
      <Icon name="chevron" size={14} color={colors.textSecondary} />
    </Pressable>
  );
}

/** The bureau's tools, on the association's dark color, so nobody takes them for a member's settings. */
function BureauBlock({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bureau, { backgroundColor: colors.banner }]}>
      <View style={styles.bureauHead}>
        <View style={styles.bureauBadge}>
          <Icon name="shield" size={15} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          <Text variant="headline" style={styles.white}>
            Espace bureau
          </Text>
          <Text variant="footnote" style={styles.whiteSoft}>
            Visible uniquement par le bureau et les administrateurs
          </Text>
        </View>
      </View>
      <View style={styles.bureauRows}>{children}</View>
    </View>
  );
}

function BureauRow({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.bureauRow, pressed && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
      <View style={styles.bureauIcon}>
        <Icon name={icon} size={17} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.white}>{title}</Text>
        {!!subtitle && (
          <Text variant="footnote" style={styles.whiteSoft} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Icon name="chevron" size={14} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 20, gap: 24, paddingBottom: 40 },
  flex: { flex: 1, gap: 2 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  bureau: { borderRadius: 20, padding: 14, gap: 12 },
  bureauHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 2 },
  bureauBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bureauRows: { gap: 8 },
  bureauRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bureauIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.75)' },
});
