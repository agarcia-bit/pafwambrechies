import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEtapesDeLaVisite } from '@/components/etapes-visite-guidee';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { INTRO_HOLD_MS } from '@/lib/launch-state';
import { useMember } from '@/lib/session';
import { closeTour, markTourDone, openTour, tourDone, useTourOpen } from '@/lib/tour';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';


const SETTLE = Easing.out(Easing.cubic);

/**
 * A few screens that show a member what the app offers, each with a small mock-up of the real
 * screen, on the association's color. Only what every member can do: the bureau and administration
 * tools are not part of it. Shown the first time the app opens on an account (on this phone), and
 * again from "Plus" > "Visite guidée".
 */
export function GuidedTour() {
  const { profile } = useMember();
  const visible = useTourOpen();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);

  // First launch on this account: wait for the opening animation, then show the tour.
  useEffect(() => {
    if (tourDone(profile.id)) return;
    const timer = setTimeout(openTour, INTRO_HOLD_MS + 900);
    return () => clearTimeout(timer);
  }, [profile.id]);

  // Each opening starts again from the first screen.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPage(0);
  }

  const steps = useEtapesDeLaVisite();
  const last = page === steps.length - 1;

  function finish() {
    markTourDone(profile.id);
    closeTour();
  }

  function goTo(next: number) {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={finish}>
      <LinearGradient colors={[mix(colors.banner, '#FFFFFF', 0.12), colors.banner, mix(colors.banner, '#000000', 0.25)]} style={styles.screen}>
        <View
          style={[styles.screen, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          accessibilityViewIsModal>
          <View style={styles.top}>
            <View style={styles.progress} accessibilityLabel={`Étape ${page + 1} sur ${steps.length}`}>
              {steps.map((s, i) => (
                <Segment key={s.key} done={i <= page} />
              ))}
            </View>
            {!last && (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={finish}>
                <Text variant="subhead" style={styles.skip}>
                  Passer
                </Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.flex}>
            {steps.map((step, i) => {
              const active = i === page;
              return (
                <View key={step.key} style={[styles.page, { width }]}>
                  <View style={styles.art}>{step.art(active)}</View>
                  <Animated.View
                    key={active ? 'on' : 'off'}
                    entering={active && !reduceMotion ? FadeInDown.delay(120).duration(420).easing(SETTLE) : undefined}
                    style={styles.copy}>
                    <Text variant="title" style={styles.title}>
                      {step.title}
                    </Text>
                    <Text style={styles.text}>{step.text}</Text>
                    {!!step.tip && (
                      <View style={styles.tip}>
                        <View style={styles.tipIcon}>
                          <Icon name="lightbulb" size={14} color="#0B5F58" />
                        </View>
                        <Text variant="subhead" style={styles.tipText}>
                          {step.tip}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            {page > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Précédent"
                onPress={() => goTo(page - 1)}
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
                <Icon name="chevronLeft" size={20} color="#FFFFFF" />
              </Pressable>
            )}
            <Button
              variant="light"
              title={last ? 'C’est parti' : 'Suivant'}
              onPress={() => (last ? finish() : goTo(page + 1))}
              style={styles.next}
            />
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

function Segment({ done }: { done: boolean }) {
  const fill = useAnimatedStyle(() => ({ width: withTiming(done ? '100%' : '0%', { duration: 350 }) }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 8, minHeight: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  segmentFill: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  skip: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  art: { flex: 1, justifyContent: 'center' },
  copy: { gap: 10, paddingBottom: 12 },
  title: { color: '#FFFFFF' },
  text: { color: 'rgba(255,255,255,0.9)', fontSize: 17, lineHeight: 25 },
  tip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tipIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, color: '#FFFFFF', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  back: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: { flex: 1 },
});
