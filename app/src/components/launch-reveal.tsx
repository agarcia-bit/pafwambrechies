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

const OPEN_MS = 700; // the screen slides down, off the bottom
const OPEN = Easing.bezier(0.65, 0, 0.25, 1);

/**
 * Opening moment, once per launch: the association's logo and name on its color, then the
 * colored screen slides down and away, uncovering the feed from the top (a transform only,
 * so it stays smooth). The cards of the feed rise into place as it goes.
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

  const cover = useAnimatedStyle(() => ({ transform: [{ translateY: height * open.value }] }));

  if (!visible) return null;
  const name = associationName(branding);
  return (
    <View pointerEvents="none" style={styles.screen} accessibilityElementsHidden>
      <Animated.View style={[styles.cover, { backgroundColor: colors.banner }, cover]}>
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
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  name: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 },
});
