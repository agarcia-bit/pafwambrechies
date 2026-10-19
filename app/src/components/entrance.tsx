import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ANIMATED_ITEMS = 6;
const STAGGER_MS = 70;

/** The first items of a list rise into place one after the other; later ones just appear. */
export function Entrance({ index, children }: { index: number; children: ReactNode }) {
  if (index >= ANIMATED_ITEMS) return <>{children}</>;
  return <Animated.View entering={FadeInDown.delay(index * STAGGER_MS).duration(450)}>{children}</Animated.View>;
}
