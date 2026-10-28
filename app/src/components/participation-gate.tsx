import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateTile } from '@/components/actu-visual';
import { useAnswerHandler } from '@/components/participation';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDayLong, venue } from '@/lib/format';
import { putOffForNow, REPONSE_LABELS, useParticipationQueue, type Reponse } from '@/lib/participation';
import { usePollQueue } from '@/lib/poll-queue';
import type { Evenement } from '@/lib/types';
import { useTheme } from '@/theme';

const THANKS_DURATION_MS = 1700;

const SETTLE = Easing.out(Easing.cubic);
const ONE_POP = Easing.out(Easing.back(1.6)); // a single small overshoot

type Finished = { event: Evenement; reponse: Reponse };

/**
 * An event within a week that asks "do you come?" covers the app until it is answered, with
 * Présent / Absent. A third, quieter choice, "Je ne sais pas encore", counts for the bureau but
 * brings the question back the next time the app opens, so nobody is shut in. Each answer is
 * confirmed by a "Merci" screen, then the next event comes, or the app. A poll to answer goes first.
 */
export function ParticipationGate() {
  const queue = useParticipationQueue();
  const polls = usePollQueue();
  const blocked = polls.gated.length > 0 || !!polls.requested;
  // The event just answered: it stays on screen ("Merci") while the queue has already moved on.
  const [finished, setFinished] = useState<Finished | null>(null);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setFinished(null), THANKS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [finished]);

  const next = !blocked ? (queue.gated[0] ?? null) : null;
  const target = finished ?? (next ? { event: next, reponse: null } : null);

  // Keep showing the last event while the modal slides away.
  const [last, setLast] = useState(target);
  if (target && (last?.event.id !== target.event.id || last.reponse !== target.reponse)) setLast(target);
  const shown = target ?? last;
  if (!shown) return null;

  return (
    // Android back button and swipe-down do nothing: answer, or say "not sure yet".
    <Modal visible={!!target} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      {shown.reponse ? (
        <Thanks key={`thanks-${shown.event.id}`} event={shown.event} reponse={shown.reponse} />
      ) : (
        <EventQuestion
          key={shown.event.id}
          event={shown.event}
          onAnswered={(reponse) => setFinished({ event: shown.event, reponse })}
        />
      )}
    </Modal>
  );
}

function Thanks({ event: ev, reponse }: { event: Evenement; reponse: Reponse }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <SafeAreaView style={[styles.screen, styles.center, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(560).easing(ONE_POP)}>
        <Icon name="checkCircle" size={110} color={colors.success} />
      </Animated.View>
      <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(260).duration(480).easing(SETTLE)} style={styles.thanks}>
        <Text variant="largeTitle">Merci !</Text>
        <Text tone="secondary">Votre réponse est enregistrée.</Text>
        <Text variant="subhead" tone="secondary" style={styles.title}>
          {ev.titre} : {REPONSE_LABELS[reponse].toLowerCase()}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function EventQuestion({ event: ev, onAnswered }: { event: Evenement; onAnswered: (reponse: Reponse) => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { pending, send } = useAnswerHandler();
  const place = venue(ev.lieu);
  const busy = pending?.evenementId === ev.id;
  const rise = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(520).easing(SETTLE));

  function answer(reponse: Reponse) {
    // "Not sure yet": the question comes back at the next launch.
    send(ev.id, reponse, () => {
      if (reponse === 'indecis') putOffForNow(ev.id);
      onAnswered(reponse);
    });
  }

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
          onPress={() => answer('present')}
        />
        <Button
          title="Absent"
          variant="secondary"
          loading={busy && pending?.reponse === 'absent'}
          disabled={busy}
          onPress={() => answer('absent')}
        />
        <Button
          title="Je ne sais pas encore"
          variant="plain"
          loading={busy && pending?.reponse === 'indecis'}
          disabled={busy}
          onPress={() => answer('indecis')}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  thanks: { alignItems: 'center', gap: 6 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  head: { alignItems: 'center', gap: 10 },
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  event: { alignItems: 'center', gap: 14 },
  title: { textAlign: 'center' },
  footer: { padding: 20, gap: 8 },
});
