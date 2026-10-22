import type { ReactNode } from 'react';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { introDelay } from '@/lib/launch-state';

const ANIMATED_ITEMS = 6;
const STAGGER_MS = 70;

/** The first items of a list rise into place one after the other; later ones just appear. */
export function Entrance({ index, children }: { index: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (index >= ANIMATED_ITEMS) return <>{children}</>;
  // While the opening animation plays, the cards wait for it to open before rising.
  const delay = introDelay(reduceMotion) + index * STAGGER_MS;
  return <Animated.View entering={FadeInDown.delay(delay).duration(450)}>{children}</Animated.View>;
}
