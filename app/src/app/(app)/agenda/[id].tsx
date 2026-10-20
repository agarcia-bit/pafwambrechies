import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTile } from '@/components/actu-visual';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { addToCalendar } from '@/lib/calendar';
import { ACTU_HUES } from '@/lib/categories';
import { useEvenements } from '@/lib/data';
import { formatDayLong } from '@/lib/format';
import { mapsUrl, openLink } from '@/lib/links';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';

// Same full-screen layout as an actu: a hero in the event color (date tile and title),
// then the practical details on a white sheet and a big "add to my calendar" button.
export default function EvenementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useEvenements();
  const ev = events.data?.find((item) => item.id === Number(id));
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const heroColor = mix(ACTU_HUES['Événement'], '#000000', 0.15);

  const closeButton = (light: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      hitSlop={10}
      onPress={() => router.back()}
      style={[styles.close, { top: insets.top + 8, backgroundColor: light ? colors.fill : 'rgba(255,255,255,0.22)' }]}>
      <Icon name="close" size={18} color={light ? undefined : '#FFFFFF'} />
    </Pressable>
  );

  if (events.isPending || !ev) {
    return (
      <View style={styles.flex}>
        {events.isPending ? (
          <LoadingState />
        ) : events.isError ? (
          <ErrorState onRetry={events.refetch} />
        ) : (
          <EmptyState title="Événement introuvable" message="Il est peut-être passé ou a été supprimé." />
        )}
        {closeButton(true)}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: heroColor, paddingTop: insets.top + 8 }]}>
          <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.heroMeta}>
            <Text variant="footnote" style={styles.heroLabel}>
              ÉVÉNEMENT
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(230).duration(500)} style={styles.heroTitleRow}>
            <DateTile date={ev.date} large />
            <Text variant="title" style={styles.heroTitle} selectable>
              {ev.titre}
            </Text>
          </Animated.View>
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Animated.View entering={FadeInDown.delay(320).duration(500)} style={[styles.details, { backgroundColor: colors.background }]}>
            <Detail icon="calendar" text={formatDayLong(ev.date)} />
            {!!ev.heure && <Detail icon="clock" text={ev.heure} />}
            {!!ev.lieu && (
              <Detail
                icon="location"
                text={ev.lieu}
                hint="Itinéraire"
                onPress={() => openLink(mapsUrl(ev.lieu!), { inApp: false })}
              />
            )}
          </Animated.View>
          {!!ev.description && (
            <Animated.View entering={FadeInDown.delay(380).duration(500)}>
              <LinkedText>{ev.description}</LinkedText>
            </Animated.View>
          )}
          {Platform.OS !== 'web' && (
            <Animated.View entering={FadeInDown.delay(440).duration(500)}>
              <Button title="Ajouter à mon agenda" icon="calendarAdd" onPress={() => addToCalendar(ev)} />
            </Animated.View>
          )}
        </View>
      </ScrollView>
      {closeButton(false)}
    </View>
  );
}

function Detail({ icon, text, hint, onPress }: { icon: IconName; text: string; hint?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={[styles.detailIcon, { backgroundColor: colors.card }]}>
        <Icon name={icon} size={18} />
      </View>
      <View style={styles.flex}>
        <Text variant="headline">{text}</Text>
        {!!hint && (
          <Text variant="footnote" tone="primary" style={styles.hint}>
            {hint} ›
          </Text>
        )}
      </View>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${text}, ${hint}`} onPress={onPress} style={styles.detail}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.detail}>{content}</View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', height: 36, marginRight: 52 },
  heroLabel: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', letterSpacing: 0.4 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroTitle: { color: '#FFFFFF', fontWeight: '800', flex: 1, fontSize: 26, lineHeight: 32 },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 18, flexGrow: 1 },
  details: { borderRadius: 16, padding: 6 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10 },
  detailIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hint: { fontWeight: '600' },
  close: { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
