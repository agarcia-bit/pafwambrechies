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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Plays once per launch of the app, over the sign-in screen.
let alreadyPlayed = false;

const FLAT_TEAL = '#0F8F83'; // the screen of the intro: a flat teal, the gradient is under it
const ICON = 100;
const NAME = 'ALLIANCEO';
const LIFT_AT_MS = 950;
const LIFT_MS = 450; // the whole opening lasts about 1.4 s

const clamp01 = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

/**
 * The opening of the app, "Glissé": on a flat teal, the icon of the app rises from the bottom
 * with a bounce, the name arrives under it, then the whole screen lifts away like a curtain,
 * uncovering the sign-in screen (transforms and opacity only, so it stays smooth).
 */
export function LoginIntro() {
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyPlayed && !reduceMotion);
  const rise = useSharedValue(height * 0.45);
  const name = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    alreadyPlayed = true;
    if (!visible) return;
    rise.value = withSpring(0, { damping: 11, stiffness: 190, mass: 0.8 });
    name.value = withDelay(330, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    lift.value = withDelay(
      LIFT_AT_MS,
      withTiming(1, { duration: LIFT_MS, easing: Easing.bezier(0.7, 0, 0.2, 1) }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, rise, name, lift]);

  const screen = useAnimatedStyle(() => ({ transform: [{ translateY: -height * lift.value }] }));
  const icon = useAnimatedStyle(() => ({
    opacity: clamp01(1 - rise.value / (height * 0.3)),
    transform: [{ translateY: rise.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.value,
    transform: [{ translateY: (1 - name.value) * 14 }],
  }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.root} accessibilityElementsHidden>
      <Animated.View style={[styles.screen, screen]}>
        <Animated.View style={icon}>
          <Image source={require('../../assets/images/icon.png')} style={styles.icon} />
        </Animated.View>
        <Animated.Text style={[styles.name, nameStyle]}>{NAME}</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FLAT_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON * 0.25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  name: { color: '#FFFFFF', fontFamily: 'Sora_800ExtraBold', fontSize: 28, lineHeight: 36, letterSpacing: 3 },
});
