import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Plays once per launch of the app, over the sign-in screen.
let alreadyPlayed = false;

// The mark of the logo, drawn at this scale (1 = the 1024 px artwork).
const K = 0.3;
const STROKE = 96 * K;
const BAR = Math.hypot(212, 510) * K; // length of one stroke of the "A"
const ANGLE = Math.atan(212 / 510); // tilt of the strokes, from the vertical
const TILT = `${(ANGLE * 180) / Math.PI}deg`;
const MARK_W = 424 * K + STROKE;
const DOT = 132 * K;
const DOT_CY = STROKE / 2 + 360 * K; // center of the amber dot inside the mark
// The mark is drawn in a box whose CENTER is the dot: scaling the box then zooms right into the dot
// (no transform origin involved, it is not reliable on animated views).
const BOX_H = 2 * DOT_CY;
// Each stroke is a capsule centered on the middle of its center line, then rotated around itself.
const MID_X = (BAR / 2) * Math.sin(ANGLE);
const MID_Y = STROKE / 2 + (BAR / 2) * Math.cos(ANGLE);
const FLAT_TEAL = '#0F8F83'; // the screen of the intro: a flat teal, the gradient is under it
const ZOOM = 30; // how much the mark grows while we dive into it
const POP_MS = 190;
const BEAT_AT_MS = 330;
const ZOOM_AT_MS = 640;
const ZOOM_MS = 720; // the whole opening lasts about 1.4 s

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

/**
 * The opening of the app, "Traversée": on a flat teal, the "A" of the logo snaps in at the
 * center, its amber dot beats once, then we dive into the dot: the mark grows very fast, its
 * strokes fly past the edges of the screen and the teal fades, which uncovers the sign-in
 * screen behind (transforms and opacity only, so it stays smooth).
 */
export function LoginIntro() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const pop = useSharedValue(0);
  const beat = useSharedValue(1);
  const zoom = useSharedValue(0);

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    pop.value = withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.back(2.2)) });
    beat.value = withDelay(
      BEAT_AT_MS,
      withSequence(withTiming(1.55, { duration: 110 }), withTiming(1, { duration: 130 }))
    );
    zoom.value = withDelay(
      ZOOM_AT_MS,
      withTiming(1, { duration: ZOOM_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, pop, beat, zoom]);

  const mark = useAnimatedStyle(() => ({
    opacity: clamp01(pop.value * 3),
    // Snaps in from small, then the dive grows it exponentially (it feels steady to the eye).
    transform: [{ scale: (0.35 + 0.65 * pop.value) * Math.pow(ZOOM, zoom.value) }],
  }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const cover = useAnimatedStyle(() => ({ opacity: 1 - clamp01((zoom.value - 0.45) / 0.55) }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.root} accessibilityElementsHidden>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: FLAT_TEAL }, cover]} />
      <Animated.View style={[styles.mark, { left: width / 2 - MARK_W / 2, top: height / 2 - BOX_H / 2 }, mark]}>
        <View
          style={[styles.bar, { left: MARK_W / 2 - MID_X - STROKE / 2, top: MID_Y - (BAR + STROKE) / 2, transform: [{ rotate: TILT }] }]}
        />
        <View
          style={[styles.bar, { left: MARK_W / 2 + MID_X - STROKE / 2, top: MID_Y - (BAR + STROKE) / 2, transform: [{ rotate: `-${TILT}` }] }]}
        />
        <Animated.View style={[styles.dot, { left: MARK_W / 2 - DOT / 2, top: DOT_CY - DOT / 2 }, dot]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  mark: { position: 'absolute', width: MARK_W, height: BOX_H },
  bar: {
    position: 'absolute',
    width: STROKE,
    height: BAR + STROKE,
    borderRadius: STROKE / 2,
    backgroundColor: '#FFFFFF',
  },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#FBBF24' },
});
