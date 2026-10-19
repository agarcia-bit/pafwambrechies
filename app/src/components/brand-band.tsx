import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Home header: the association name on its colored band, with the filters below it. */
export function BrandBand({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, { backgroundColor: colors.banner, paddingTop: insets.top + 12 }]}>
      <Text variant="title1" style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingBottom: 14, gap: 12 },
  title: { color: '#FFFFFF', fontWeight: '800', paddingHorizontal: 16, letterSpacing: 0.3 },
});
