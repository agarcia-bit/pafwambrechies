import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

// Sober and airy on purpose: no bounce, no spring, no movement of the screen: it dissolves.
const DEEP_TEAL = '#0A5C55';
const ICON = 96;
const NAME = 'ALLIANCEO';
const SMOOTH = Easing.bezier(0.16, 1, 0.3, 1); // very soft landing
const DISSOLVE = Easing.bezier(0.45, 0, 0.55, 1); // calm start, calm end
const DISSOLVE_AT_MS = 2000;
const DISSOLVE_MS = 800; // the whole opening lasts about 2.8 s

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

/**
 * The opening of the app: on a deep teal, the icon settles in with a slow fade and the barest
 * growth, the name appears under it with its letters closing in, a fine amber line is drawn,
 * then everything dissolves into the sign-in screen behind (cross-fade, nothing moves).
 */
export function LoginIntro() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const icon = useSharedValue(0);
  const name = useSharedValue(0);
  const line = useSharedValue(0);
  const dissolve = useSharedValue(0);

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    icon.value = withDelay(200, withTiming(1, { duration: 1100, easing: SMOOTH }));
    name.value = withDelay(700, withTiming(1, { duration: 1100, easing: SMOOTH }));
    line.value = withDelay(1250, withTiming(1, { duration: 800, easing: SMOOTH }));
    dissolve.value = withDelay(
      DISSOLVE_AT_MS,
      withTiming(1, { duration: DISSOLVE_MS, easing: DISSOLVE }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, icon, name, line, dissolve]);

  const screen = useAnimatedStyle(() => ({ opacity: 1 - dissolve.value }));
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
