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

const OPEN_MS = 700; // the two halves slide apart, up and down
const OPEN = Easing.bezier(0.65, 0, 0.25, 1);

/**
 * Opening moment, once per launch: the association's logo and name on its color, then the
 * screen splits across the middle: the top half slides up and the bottom half slides down,
 * the logo fading as it goes, uncovering the feed (transforms only, so it stays smooth).
 * The cards of the feed rise into place as it opens.
 */
export function LaunchReveal() {
  const { colors } = useTheme();
  const { branding } = useMember();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(introPending() && !reduceMotion);
  const open = useSharedValue(0);

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

  const top = useAnimatedStyle(() => ({ transform: [{ translateY: -(height / 2) * open.value }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: (height / 2) * open.value }] }));
  const logo = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 3),
    transform: [{ scale: 1 + open.value * 0.4 }],
  }));

  if (!visible) return null;
  const name = associationName(branding);
  return (
    <View pointerEvents="none" style={styles.screen} accessibilityElementsHidden>
      <Animated.View style={[styles.half, styles.top, { backgroundColor: colors.banner }, top]} />
      <Animated.View style={[styles.half, styles.bottom, { backgroundColor: colors.banner }, bottom]} />
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
  half: { position: 'absolute', left: 0, right: 0, height: '50%' },
  top: { top: 0 },
  bottom: { bottom: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  name: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 },
});
