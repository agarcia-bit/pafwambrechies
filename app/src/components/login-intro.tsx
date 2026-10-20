import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AUTH_GRADIENT } from '@/components/auth-screen';
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
const WORD = 'ALLIANCEO'.split('');
const HOLD_MS = 2250; // everything is drawn, then the screen opens
const OPEN_MS = 750;

/** One stroke of the "A": it grows from the apex (scaleY 0 to 1) at its tilt. */
function useBarStyle(progress: SharedValue<number>, tilt: string) {
  return useAnimatedStyle(() => ({ transform: [{ rotate: tilt }, { scaleY: progress.value }] }));
}

/**
 * The opening of the app: on the teal, the "A" of the logo draws itself stroke by stroke,
 * its amber dot drops in and bounces, the name appears letter by letter, then the screen
 * splits across the middle and slides away, up and down, uncovering the sign-in screen.
 */
export function LoginIntro() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const dotY = useSharedValue(-260);
  const dotOpacity = useSharedValue(0);
  const open = useSharedValue(0);

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    const draw = { duration: 650, easing: Easing.out(Easing.cubic) };
    left.value = withTiming(1, draw);
    right.value = withDelay(220, withTiming(1, draw));
    dotOpacity.value = withDelay(800, withTiming(1, { duration: 120 }));
    dotY.value = withDelay(800, withSpring(0, { damping: 7, stiffness: 150, mass: 0.9 }));
    open.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: OPEN_MS, easing: Easing.bezier(0.7, 0, 0.2, 1) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, left, right, dotY, dotOpacity, open]);

  const leftBar = useBarStyle(left, TILT);
  const rightBar = useBarStyle(right, `-${TILT}`);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ translateY: dotY.value }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 2.5),
    transform: [{ scale: 1 + open.value * 0.25 }],
  }));
  const top = useAnimatedStyle(() => ({ transform: [{ translateY: -(height / 2) * open.value }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: (height / 2) * open.value }] }));

  if (!visible) return null;
  const gradient = (
    <LinearGradient
      colors={AUTH_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', left: 0, width, height }}
    />
  );
  return (
    <View pointerEvents="none" style={styles.screen} accessibilityElementsHidden>
      {/* Two halves of the same gradient as the screen behind, so that the opening is seamless. */}
      <Animated.View style={[styles.half, { top: 0, height: height / 2 }, top]}>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>{gradient}</View>
      </Animated.View>
      <Animated.View style={[styles.half, { bottom: 0, height: height / 2 }, bottom]}>
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <LinearGradient
            colors={AUTH_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, top: -height / 2, width, height }}
          />
        </View>
      </Animated.View>

      <Animated.View style={[styles.center, content]}>
        <View style={{ width: MARK_W, height: MARK_H }}>
          <Animated.View style={[styles.bar, { left: MARK_W / 2 - STROKE / 2 }, leftBar]} />
          <Animated.View style={[styles.bar, { left: MARK_W / 2 - STROKE / 2 }, rightBar]} />
          <Animated.View
            style={[
              styles.dot,
              { left: MARK_W / 2 - DOT / 2, top: STROKE / 2 + (620 - 260) * K - DOT / 2 },
              dotStyle,
            ]}
          />
        </View>
        <View style={styles.word}>
          {WORD.map((letter, index) => (
            <Animated.View key={index} entering={FadeInDown.delay(1250 + index * 60).duration(380)}>
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
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  half: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 28 },
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
  word: { flexDirection: 'row' },
  letter: { color: '#FFFFFF', letterSpacing: 3 },
});
