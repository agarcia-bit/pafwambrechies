import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';

// Plays once per launch of the app, over the sign-in screen.
let alreadyPlayed = false;

// The mark of the logo, drawn at this scale (1 = the 1024 px artwork).
const K = 0.3;
const STROKE = 96 * K;
const BAR = Math.hypot(212, 510) * K; // length of one stroke of the "A"
const TILT = `${(Math.atan(212 / 510) * 180) / Math.PI}deg`;
const MARK_W = 424 * K + STROKE;
const MARK_H = 510 * K + STROKE;
const DOT = 132 * K;
const DOT_CY = STROKE / 2 + 360 * K; // center of the amber dot inside the mark
const WORD = 'ALLIANCEO'.split('');
const FLAT_TEAL = '#0F8F83'; // the screen of the intro: a flat teal, the gradient is revealed under it
const HOLE = 16; // radius of the hole in the screen at the start (hidden behind the dot)
const RING = 1300; // thickness of the screen around the hole: its outer edge always covers everything
const RIPPLE = 90; // diameter of a ripple at its birth
// All the timings below are the original ones times SPEED (0.4 = two and a half times faster).
const SPEED = 0.4;
const ms = (value: number) => Math.round(value * SPEED);
const HOLD_MS = ms(3000); // everything is on screen, then the circle opens
const OPEN_MS = ms(850);

function useRipple(delay: number) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: ms(1500), easing: Easing.out(Easing.quad) }));
  }, [delay, progress]);
  return useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 0.85 * (1 - progress.value),
    transform: [{ scale: 0.15 + progress.value * 5.2 }],
  }));
}

/**
 * The opening of the app, "Éclat": on a flat teal, the amber dot of the logo blooms with
 * ripples spreading from it, the "A" appears around it, the name rises letter by letter,
 * then a circle opens from the dot and reveals the sign-in screen (transforms only, so it
 * stays smooth).
 */
export function LoginIntro() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const dot = useSharedValue(0);
  const mark = useSharedValue(0);
  const open = useSharedValue(0);
  const ripple1 = useRipple(ms(350));
  const ripple2 = useRipple(ms(750));
  const ripple3 = useRipple(ms(1150));
  const endScale = (Math.hypot(width, height) / 2 + 60) / HOLE;

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    // The dot blooms (overshoot, then settles) as soon as the screen appears.
    dot.value = withSequence(
      withTiming(1.7, { duration: ms(380), easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 9, stiffness: 420, mass: 0.6 })
    );
    mark.value = withDelay(ms(1500), withTiming(1, { duration: ms(650), easing: Easing.out(Easing.back(1.3)) }));
    open.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: OPEN_MS, easing: Easing.bezier(0.65, 0, 0.25, 1) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, dot, mark, open]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.6 + 0.4 * mark.value }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 3),
    transform: [{ scale: 1 + open.value * 0.3 }],
  }));
  const screen = useAnimatedStyle(() => ({ transform: [{ scale: 1 + open.value * (endScale - 1) }] }));

  if (!visible) return null;
  const markTop = height / 2 - DOT_CY;
  return (
    <View pointerEvents="none" style={styles.root} accessibilityElementsHidden>
      <View style={styles.screenBox}>
        <Animated.View style={[styles.screen, screen]} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, content]}>
        {[ripple1, ripple2, ripple3].map((style, index) => (
          <Animated.View
            key={index}
            style={[styles.ripple, { left: width / 2 - RIPPLE / 2, top: height / 2 - RIPPLE / 2 }, style]}
          />
        ))}

        <Animated.View
          style={[
            styles.mark,
            { left: width / 2 - MARK_W / 2, top: markTop, transformOrigin: `${MARK_W / 2}px ${DOT_CY}px` },
            markStyle,
          ]}>
          <View style={[styles.bar, { left: MARK_W / 2 - STROKE / 2, transform: [{ rotate: TILT }] }]} />
          <View style={[styles.bar, { left: MARK_W / 2 - STROKE / 2, transform: [{ rotate: `-${TILT}` }] }]} />
        </Animated.View>

        <Animated.View
          style={[styles.dot, { left: width / 2 - DOT / 2, top: height / 2 - DOT / 2 }, dotStyle]}
        />

        <View style={[styles.word, { top: markTop + MARK_H + 28 }]}>
          {WORD.map((letter, index) => (
            <Animated.View key={index} entering={FadeInDown.delay(ms(1900) + index * ms(60)).duration(ms(400))}>
              <Text variant="largeTitle" style={styles.letter}>
                {letter}
              </Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  // The screen is a disc with a thick border: its middle is the hole that grows to reveal the sign-in screen.
  screenBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  screen: {
    width: 2 * (HOLE + RING),
    height: 2 * (HOLE + RING),
    borderRadius: HOLE + RING,
    borderWidth: RING,
    borderColor: FLAT_TEAL,
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mark: { position: 'absolute', width: MARK_W, height: MARK_H },
  bar: {
    position: 'absolute',
    top: 0,
    width: STROKE,
    height: BAR + STROKE,
    borderRadius: STROKE / 2,
    backgroundColor: '#FFFFFF',
    // Pivot: the center of the round end at the apex.
    transformOrigin: `${STROKE / 2}px ${STROKE / 2}px`,
  },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#FBBF24' },
  word: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  letter: { color: '#FFFFFF', letterSpacing: 3 },
});
