import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Plays once per launch of the app, over the sign-in screen.
let alreadyPlayed = false;

// Sober and slow on purpose: no bounce, no spring, one gesture at a time.
const DEEP_TEAL = '#0A5C55';
const ICON = 96;
const NAME = 'ALLIANCEO';
const SMOOTH = Easing.bezier(0.16, 1, 0.3, 1); // very soft landing
const LIFT = Easing.bezier(0.76, 0, 0.24, 1); // calm start, calm end
const LIFT_AT_MS = 1250;
const LIFT_MS = 650; // the whole opening lasts about 1.9 s

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

/**
 * The opening of the app: on a deep teal, the icon settles in with a slow fade and the barest
 * growth, the name appears under it with its letters closing in, a fine amber line is drawn,
 * then the screen lifts away smoothly and uncovers the sign-in screen (transforms and
 * opacity only, so it stays smooth).
 */
export function LoginIntro() {
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const icon = useSharedValue(0);
  const name = useSharedValue(0);
  const line = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    icon.value = withDelay(150, withTiming(1, { duration: 800, easing: SMOOTH }));
    name.value = withDelay(500, withTiming(1, { duration: 800, easing: SMOOTH }));
    line.value = withDelay(850, withTiming(1, { duration: 650, easing: SMOOTH }));
    lift.value = withDelay(
      LIFT_AT_MS,
      withTiming(1, { duration: LIFT_MS, easing: LIFT }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, icon, name, line, lift]);

  const screen = useAnimatedStyle(() => ({ transform: [{ translateY: -height * lift.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: icon.value,
    transform: [{ scale: 0.94 + 0.06 * icon.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.value,
    letterSpacing: 6 - 3.5 * name.value,
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: clamp01(line.value * 2),
    transform: [{ scaleX: line.value }],
  }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.root} accessibilityElementsHidden>
      <Animated.View style={[styles.screen, screen]}>
        <Animated.View style={iconStyle}>
          <Image source={require('../../assets/images/icon.png')} style={styles.icon} />
        </Animated.View>
        <Animated.Text style={[styles.name, nameStyle]}>{NAME}</Animated.Text>
        <Animated.View style={[styles.line, lineStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DEEP_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON * 0.225,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  name: { color: '#FFFFFF', fontFamily: 'Sora_700Bold', fontSize: 24, lineHeight: 32, paddingLeft: 6 },
  line: { width: 44, height: 2, borderRadius: 1, backgroundColor: '#FBBF24' },
});
