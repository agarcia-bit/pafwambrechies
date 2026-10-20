import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Home header: the association name on its colored band, with the filters below it. */
export function BrandBand({ title, greeting, children }: PropsWithChildren<{ title: string; greeting?: string }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { backgroundColor: colors.banner, paddingTop: insets.top + 12 }]}>
      <View style={styles.titles}>
        {!!greeting && (
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>
            <Text variant="subhead" style={styles.greeting}>
              {greeting}
            </Text>
          </Animated.View>
        )}
      <Text variant="largeTitle" style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingBottom: 14, gap: 12 },
  titles: { gap: 2, paddingHorizontal: 16 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  title: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.3 },
});
