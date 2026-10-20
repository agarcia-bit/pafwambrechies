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
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

// Shown once per launch of the app (not each time the member comes back to it).
let alreadyShown = false;
const HOLD_MS = 1250; // the logo and the name are shown
const OPEN_MS = 650; // the two halves slide apart onto the feed
const OPEN = Easing.bezier(0.7, 0, 0.2, 1);

/**
 * Opening moment: the association's logo and name on its color, then the screen opens
 * like double doors, the logo growing and fading, to show the feed behind it.
 */
export function LaunchReveal() {
  const { colors } = useTheme();
  const { branding } = useMember();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyShown && !reduceMotion);
  const open = useSharedValue(0);

  useEffect(() => {
    alreadyShown = true;
    if (!visible) return;
    open.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: OPEN_MS, easing: OPEN }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      })
    );
  }, [visible, open]);

  const half = width / 2;
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: -half * open.value }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: half * open.value }] }));
  const logo = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, open.value * 2.2),
    transform: [{ scale: 1 + open.value * 0.6 }],
  }));

  if (!visible) return null;
  const name = associationName(branding);
  return (
    <View pointerEvents="none" style={styles.screen} accessibilityElementsHidden>
      <Animated.View style={[styles.door, styles.left, { backgroundColor: colors.banner }, left]} />
      <Animated.View style={[styles.door, styles.right, { backgroundColor: colors.banner }, right]} />
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
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  door: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  left: { left: 0 },
  right: { right: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  name: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 },
});
