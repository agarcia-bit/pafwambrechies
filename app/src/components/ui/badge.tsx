import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';
import { tint } from '@/theme/colors';

/** Small rounded label; `hue` colors it (e.g. per actu category). */
export function Badge({ label, hue }: { label: string; hue?: string }) {
  const { colors, scheme } = useTheme();
  const { background, color } = hue ? tint(scheme, hue) : { background: colors.fill, color: colors.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text variant="caption" style={{ color, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
