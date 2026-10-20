import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { introDelay } from '@/lib/launch-state';
import { useTheme } from '@/theme';

// Every tab has the SAME band (same height, same place for the line above the title, the title
// and the row below it), so that nothing jumps when one goes from a tab to another.
const SUBTITLE_HEIGHT = 20;
const ROW_HEIGHT = 42; // the height of a row of filter chips

/**
 * Header of a tab: the colored band with a line above, the title in capitals and a row below it
 * (filters, or a small pill). It also extends far above the screen, so that pulling the list down
 * shows the same color instead of grey.
 */
export function BrandBand({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <View style={[styles.band, { backgroundColor: colors.banner, paddingTop: insets.top + 12 }]}>
      <View pointerEvents="none" style={[styles.overscroll, { backgroundColor: colors.banner }]} />
      <View style={styles.titles}>
        <Animated.View
          entering={FadeInDown.delay(200 + introDelay(reduceMotion)).duration(450)}
          style={styles.subtitleBox}>
          {!!subtitle && (
            <Text variant="subhead" style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </Animated.View>
        <Text variant="largeTitle" style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          {title.toUpperCase()}
        </Text>
      </View>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

/** A small information pill for the row of a band that has no filters. */
export function BandPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="subhead" style={styles.pillText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingBottom: 14, gap: 12 },
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1500, height: 1500 },
  titles: { gap: 2, paddingHorizontal: 16 },
  subtitleBox: { height: SUBTITLE_HEIGHT, justifyContent: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  title: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.8 },
  row: { minHeight: ROW_HEIGHT, justifyContent: 'center' },
  pill: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pillText: { color: '#FFFFFF', fontWeight: '600' },
});
