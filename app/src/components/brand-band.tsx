import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Home header: the association name on its colored band, with the filters below it. */
export function BrandBand({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.band, { backgroundColor: colors.banner, paddingTop: 12 }]}>
      <Text variant="largeTitle" style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
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
