import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';

import { associationName } from '@/components/association';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

// Shown once per launch of the app (not each time the member comes back to it).
let alreadyShown = false;
const HOLD_MS = 1300;

/** Opening moment: the association's logo and name on its color, then the app appears. */
export function LaunchReveal() {
  const { colors } = useTheme();
  const { branding } = useMember();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!alreadyShown && !reduceMotion);

  useEffect(() => {
    alreadyShown = true;
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  const name = associationName(branding);
  return (
    <Animated.View
      exiting={FadeOut.duration(450)}
      pointerEvents="none"
      style={[styles.screen, { backgroundColor: colors.banner }]}
      accessibilityElementsHidden>
      <Animated.View entering={ZoomIn.duration(650).easing(Easing.out(Easing.back(1.4)))}>
        <Avatar name={name} uri={branding?.tenant_logo_url} size={104} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(350).duration(500)}>
        <Text variant="title" style={styles.name}>
          {name.toUpperCase()}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', gap: 20 },
  name: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 24 },
});
