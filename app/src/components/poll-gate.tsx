import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { usePollQueue } from '@/lib/poll-queue';
import { useAnswerSondage, useRefreshSondages, type MemberSondage, type SondageOption } from '@/lib/sondages';
import { useTheme } from '@/theme';

const THANKS_DURATION_MS = 1700;

// Readable motion: it eases in, settles cleanly, and never bounces for long.
const SETTLE = Easing.out(Easing.cubic);
const ONE_POP = Easing.out(Easing.back(1.6)); // a single small overshoot

type Shown = { poll: MemberSondage; canPostpone: boolean; voluntary: boolean };

/**
 * A poll the member has not answered covers the whole app, before anything else.
 * It opens with the app (or when the app comes back with a new poll) and goes away
 * once answered, with a "thank you" animation. A required poll cannot be put off; any
 * other can be postponed once (usePollQueue), and a postponed poll can be answered
 * from the feed, in which case this screen has a way back. Same rules for admins.
 */
export function PollGate() {
  const queue = usePollQueue();
  const refresh = useRefreshSondages();
  // The poll just answered: it stays on screen ("Merci") while it is already removed behind the modal.
  const [finishing, setFinishing] = useState<MemberSondage | null>(null);

  useEffect(() => {
    if (!finishing) return;
    const timer = setTimeout(() => setFinishing(null), THANKS_DURATION_MS);
    return () => clearTimeout(timer);
  }, [finishing]);

  const target: Shown | null = finishing
    ? { poll: finishing, canPostpone: false, voluntary: false }
    : queue.requested
      ? { poll: queue.requested, canPostpone: false, voluntary: true }
      : queue.gated[0]
        ? { ...queue.gated[0], voluntary: false }
        : null;

  // Keep showing the last poll while the modal slides away.
  const [last, setLast] = useState<Shown | null>(target);
  if (target && (last?.poll.id !== target.poll.id || last.canPostpone !== target.canPostpone || last.voluntary !== target.voluntary)) {
    setLast(target);
  }
  const shown = target ?? last;
  if (!shown) return null;

  return (
    // Android back button and swipe-down do nothing: the poll must be answered.
    <Modal visible={!!target} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <PollScreen
        key={shown.poll.id}
        poll={shown.poll}
        onPostpone={shown.canPostpone ? () => queue.postpone(shown.poll) : undefined}
        onClose={shown.voluntary ? () => queue.requestPoll(null) : undefined}
        onAnswered={() => {
          setFinishing(shown.poll);
          // Right away: the card of the feed disappears now, hidden by the "Merci" screen.
          queue.settle(shown.poll.id).finally(refresh);
        }}
      />
    </Modal>
  );
}

function PollScreen({
  poll,
  onPostpone,
  onClose,
  onAnswered,
}: {
  poll: MemberSondage;
  onPostpone?: () => void;
  onClose?: () => void;
  onAnswered: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const answer = useAnswerSondage();
  const [choice, setChoice] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  function send() {
    if (choice == null) return;
    answer.mutate(
      { sondageId: poll.id, optionId: choice },
      {
        onSuccess: () => {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDone(true);
          onAnswered();
        },
        onError: () => showMessage('Réponse non envoyée', 'Vérifiez votre connexion et réessayez.'),
      }
    );
  }

  // No "later" and no way back: the poll must be answered to get into the app.
  const mandatory = !onPostpone && !onClose;

  // Each element rises into place right after the previous one, unless motion is reduced.
  const rise = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(560).easing(SETTLE));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      {done ? (
        <View style={styles.center}>
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(560).easing(ONE_POP)}>
            <Icon name="checkCircle" size={110} color={colors.success} />
          </Animated.View>
          <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(260).duration(480).easing(SETTLE)} style={styles.thanks}>
            <Text variant="largeTitle">Merci !</Text>
            <Text tone="secondary">Votre réponse est enregistrée.</Text>
          </Animated.View>
        </View>
      ) : (
        <Animated.View style={styles.flex} exiting={reduceMotion ? undefined : FadeOut.duration(180)}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Animated.View
                entering={reduceMotion ? undefined : ZoomIn.delay(120).duration(560).easing(ONE_POP)}
                style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Icon name="poll" size={30} />
              </Animated.View>
              <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(320).duration(450)}>
                <Text variant="subhead" tone="primary" style={styles.label}>
                  Sondage
                </Text>
              </Animated.View>
            </View>
            <Animated.View entering={rise(300)}>
              <Text variant="largeTitle" style={styles.question}>
                {poll.question}
              </Text>
            </Animated.View>
            {mandatory && (
              <Animated.View entering={rise(400)} style={styles.mandatory}>
                <Icon name="lock" size={16} color={colors.textSecondary} />
                <Text variant="subhead" tone="secondary" style={styles.mandatoryText}>
                  Votre réponse est obligatoire pour passer à l’application.
                </Text>
              </Animated.View>
            )}
            <View style={styles.options} accessibilityRole="radiogroup">
              {poll.sondage_options.map((option, index) => (
                <Animated.View key={option.id} entering={rise(540 + index * 120)}>
                  <OptionRow option={option} selected={option.id === choice} onSelect={() => setChoice(option.id)} />
                </Animated.View>
              ))}
            </View>
          </ScrollView>
          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.delay(760 + poll.sondage_options.length * 70).duration(450).easing(SETTLE)}
            style={styles.footer}>
            <Button title="Répondre" onPress={send} disabled={choice == null} loading={answer.isPending} />
            {onPostpone && <Button title="Plus tard" variant="plain" onPress={onPostpone} />}
            {onClose && <Button title="Retour" variant="plain" onPress={onClose} />}
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function OptionRow({ option, selected, onSelect }: { option: SondageOption; selected: boolean; onSelect: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          // A small pop confirms the choice.
          if (!reduceMotion) scale.set(withSequence(withTiming(1.035, { duration: 130 }), withTiming(1, { duration: 190 })));
          onSelect();
        }}
        style={[
          styles.option,
          {
            backgroundColor: selected ? colors.primarySoft : colors.card,
            borderColor: selected ? colors.primary : colors.separator,
          },
        ]}>
        <Icon name={selected ? 'checkCircle' : 'circle'} size={24} color={selected ? colors.primary : colors.textSecondary} />
        <Text variant="headline" style={styles.optionText}>
          {option.libelle}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  thanks: { alignItems: 'center', gap: 6 },
  // flexGrow + center: the poll sits in the middle of the free space, between the top of the screen and the buttons.
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  head: { alignItems: 'center', gap: 10 },
  badge: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  question: { textAlign: 'center' },
  mandatory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  mandatoryText: { flexShrink: 1, textAlign: 'center' },
  options: { gap: 10, marginTop: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 56,
  },
  optionText: { flex: 1 },
  footer: { padding: 20, gap: 4 },
});
