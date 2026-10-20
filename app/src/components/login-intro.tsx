import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
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
const BAR = Math.hypot(212, 510) * K; // length of the center line of one stroke of the "A"
const BAR_VIEW = BAR + STROKE; // the capsule that draws it (round ends included)
const ANGLE = Math.atan(212 / 510); // tilt of the strokes, from the vertical
const TILT = `${(ANGLE * 180) / Math.PI}deg`;
const MARK_W = 424 * K + STROKE;
const MARK_H = 510 * K + STROKE;
const DOT = 132 * K;
const DOT_CY = STROKE / 2 + 360 * K; // center of the amber dot inside the mark
// The mark is drawn in a box whose CENTER is the dot, and the box is centered on the screen: the
// dot is at the center of the screen, where the circle that opens the screen starts.
const BOX_H = 2 * DOT_CY;
// Each stroke is a capsule centered on the middle of its center line, then rotated around itself.
const MID_X = (BAR / 2) * Math.sin(ANGLE);
const MID_Y = STROKE / 2 + (BAR / 2) * Math.cos(ANGLE);
const NAME = 'ALLIANCEO';
const FLAT_TEAL = '#0F8F83'; // the screen of the intro: a flat teal, the gradient is under it
const HOLE = 16; // radius of the hole in the screen at the start (hidden behind the dot)
const RING = 1300; // thickness of the screen around the hole: its outer edge always covers everything
const OPEN_AT_MS = 950;
const OPEN_MS = 450; // the whole opening lasts about 1.4 s

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

/** A stroke of the "A": drawn from the apex (a capsule that grows from its top end). */
function useStroke(progress: SharedValue<number>, tilt: string) {
  return useAnimatedStyle(() => ({
    transform: [{ rotate: tilt }, { translateY: ((1 - progress.value) * BAR_VIEW) / 2 }, { scaleY: progress.value }],
  }));
}

/**
 * The opening of the app, "Pop": on a flat teal, the amber dot of the logo snaps in, the "A" is
 * traced around it in one gesture, the name tightens in under it, then a circle opens from the
 * dot and uncovers the sign-in screen (transforms and opacity only, so it stays smooth).
 */
export function LoginIntro() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const dot = useSharedValue(0);
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const name = useSharedValue(0);
  const open = useSharedValue(0);
  const endScale = (Math.hypot(width, height) / 2 + 60) / HOLE;

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    const draw = { duration: 380, easing: Easing.out(Easing.cubic) };
    dot.value = withSequence(
      withTiming(1.65, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 130, easing: Easing.out(Easing.back(2)) })
    );
    left.value = withDelay(90, withTiming(1, draw));
    right.value = withDelay(200, withTiming(1, draw));
    name.value = withDelay(450, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    open.value = withDelay(
      OPEN_AT_MS,
      withTiming(1, { duration: OPEN_MS, easing: Easing.bezier(0.65, 0, 0.25, 1) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, dot, left, right, name, open]);

  const leftStroke = useStroke(left, TILT);
  const rightStroke = useStroke(right, `-${TILT}`);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: clamp01(name.value * 1.6),
    letterSpacing: 12 - 9 * name.value, // wide at first, then tightens
    transform: [{ translateY: (1 - name.value) * 6 }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: 1 - clamp01(open.value * 3),
    transform: [{ scale: 1 + open.value * 0.25 }],
  }));
  const screen = useAnimatedStyle(() => ({ transform: [{ scale: 1 + open.value * (endScale - 1) }] }));

  if (!visible) return null;
  const markTop = height / 2 - BOX_H / 2;
  return (
    <View pointerEvents="none" style={styles.root} accessibilityElementsHidden>
      <View style={styles.screenBox}>
        <Animated.View style={[styles.screen, screen]} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, content]}>
        <View style={[styles.mark, { left: width / 2 - MARK_W / 2, top: markTop }]}>
          <Animated.View
            style={[styles.bar, { left: MARK_W / 2 - MID_X - STROKE / 2, top: MID_Y - BAR_VIEW / 2 }, leftStroke]}
          />
          <Animated.View
            style={[styles.bar, { left: MARK_W / 2 + MID_X - STROKE / 2, top: MID_Y - BAR_VIEW / 2 }, rightStroke]}
          />
          <Animated.View style={[styles.dot, { left: MARK_W / 2 - DOT / 2, top: DOT_CY - DOT / 2 }, dotStyle]} />
        </View>
        <View style={[styles.nameBox, { top: markTop + MARK_H + 26 }]}>
          <Animated.Text style={[styles.name, nameStyle]}>{NAME}</Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  // The screen is a disc with a thick border: its middle is the hole that grows to uncover the sign-in screen.
  screenBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  screen: {
    width: 2 * (HOLE + RING),
    height: 2 * (HOLE + RING),
    borderRadius: HOLE + RING,
    borderWidth: RING,
    borderColor: FLAT_TEAL,
  },
  mark: { position: 'absolute', width: MARK_W, height: BOX_H },
  bar: {
    position: 'absolute',
    width: STROKE,
    height: BAR_VIEW,
    borderRadius: STROKE / 2,
    backgroundColor: '#FFFFFF',
  },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#FBBF24' },
  nameBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  name: { color: '#FFFFFF', fontFamily: 'Sora_800ExtraBold', fontSize: 30, lineHeight: 38 },
});
