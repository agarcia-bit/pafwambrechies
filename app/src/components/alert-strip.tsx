import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Thin red strip at the top of the home feed (dues to renew, event to answer): one tap opens the detail. */
export function AlertStrip({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.strip, { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.row}>
        <Icon name={icon} size={18} color="#FFFFFF" />
        <Text variant="subhead" style={styles.label} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Icon name="chevron" size={13} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  label: { color: '#FFFFFF', fontWeight: '700', flexShrink: 1 },
});
