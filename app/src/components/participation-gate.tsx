import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnswerHandler } from '@/components/participation';
import { DateTile } from '@/components/actu-visual';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDayLong, venue } from '@/lib/format';
import { usePollQueue } from '@/lib/poll-queue';
import { putOffForNow, useParticipationQueue } from '@/lib/participation';
import type { Evenement } from '@/lib/types';
import { useTheme } from '@/theme';

const SETTLE = Easing.out(Easing.cubic);

/**
 * An event within a week that asks "do you come?" covers the app until it is answered, with
 * Présent / Absent. A third, quieter choice, "Je ne sais pas encore", counts for the bureau but
 * brings the question back the next time the app opens, so nobody is shut in. When several events
 * wait they come one after the other. A poll to answer goes first.
 */
export function ParticipationGate() {
  const queue = useParticipationQueue();
  const polls = usePollQueue();
  const blocked = polls.gated.length > 0 || !!polls.requested;
  const target = !blocked ? (queue.gated[0] ?? null) : null;

  // Keep showing the last event while the modal slides away.
  const [last, setLast] = useState<Evenement | null>(target);
  if (target && last?.id !== target.id) setLast(target);
  const shown = target ?? last;
  if (!shown) return null;

  return (
    // Android back button and swipe-down do nothing: answer, or say "not sure yet".
    <Modal visible={!!target} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <EventQuestion key={shown.id} event={shown} />
    </Modal>
  );
}

function EventQuestion({ event: ev }: { event: Evenement }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { pending, send } = useAnswerHandler();
  const place = venue(ev.lieu);
  const busy = pending?.evenementId === ev.id;
  const rise = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(520).easing(SETTLE));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Animated.View
            entering={reduceMotion ? undefined : ZoomIn.delay(100).duration(520)}
            style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
            <Icon name="calendar" size={30} />
          </Animated.View>
          <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(280).duration(400)}>
            <Text variant="subhead" tone="primary" style={styles.label}>
              Vous venez ?
            </Text>
          </Animated.View>
        </View>
        <Animated.View entering={rise(280)} style={styles.event}>
          <DateTile date={ev.date} large />
          <Text variant="largeTitle" style={styles.title}>
            {ev.titre}
          </Text>
          <Text tone="secondary" style={styles.title}>
            {[formatDayLong(ev.date), ev.heure, place].filter(Boolean).join(' · ')}
          </Text>
        </Animated.View>
      </ScrollView>
      <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(520).duration(450).easing(SETTLE)} style={styles.footer}>
        <Button
          title="Présent"
          icon="checkCircle"
          loading={busy && pending?.reponse === 'present'}
          disabled={busy}
          onPress={() => send(ev.id, 'present')}
        />
        <Button
          title="Absent"
          variant="secondary"
          loading={busy && pending?.reponse === 'absent'}
          disabled={busy}
          onPress={() => send(ev.id, 'absent')}
        />
        {/* Counts as an answer for the bureau; the question comes back at the next launch. */}
        <Button
          title="Je ne sais pas encore"
          variant="plain"
          loading={busy && pending?.reponse === 'indecis'}
          disabled={busy}
          onPress={() => send(ev.id, 'indecis', () => putOffForNow(ev.id))}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  head: { alignItems: 'center', gap: 10 },
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  event: { alignItems: 'center', gap: 14 },
  title: { textAlign: 'center' },
  footer: { padding: 20, gap: 8 },
});
