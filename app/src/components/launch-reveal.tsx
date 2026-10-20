import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { associationName } from '@/components/association';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { INTRO_HOLD_MS, introPending, markIntroShown } from '@/lib/launch-state';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

const OPEN_MS = 850; // the iris opens onto the feed
const OPEN = Easing.bezier(0.65, 0, 0.2, 1);
// The colored screen is a disc with a thick border: its transparent middle is the "hole"
// that grows from the logo to beyond the corners of the screen.
const RING = 1600;

/**
 * Opening moment, once per launch: the association's logo and name on its color, then a
 * circle opens from the logo and reveals the feed, whose cards rise into place.
 */
export function LaunchReveal() {
  const { colors } = useTheme();
  const { branding } = useMember();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(introPending() && !reduceMotion);
  const open = useSharedValue(0);
  const hole = Math.hypot(width, height) + 60;

  useEffect(() => {
    markIntroShown();
    if (!visible) return;
    open.value = withDelay(
      INTRO_HOLD_MS,
      withTiming(1, { duration: OPEN_MS, easing: OPEN }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, open]);

  const iris = useAnimatedStyle(() => {
    const size = open.value * hole + 2 * RING;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: width / 2 - size / 2,
      top: height / 2 - size / 2,
    };
  });
  const logo = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 3),
    transform: [{ scale: 1 + open.value * 0.5 }],
  }));

  if (!visible) return null;
  const name = associationName(branding);
  return (
    <View pointerEvents="none" style={styles.screen} accessibilityElementsHidden>
      <Animated.View style={[styles.iris, { borderWidth: RING, borderColor: colors.banner }, iris]} />
      <Animated.View style={[styles.center, logo]}>
        <Animated.View entering={ZoomIn.duration(650).easing(Easing.out(Easing.back(1.4)))}>
          <Avatar name={name} uri={branding?.tenant_logo_url} size={104} />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(350).duration(500)}>
          <Text variant="title" style={styles.name}>
            {name.toUpperCase()}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden' },
  iris: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  name: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 },
});
