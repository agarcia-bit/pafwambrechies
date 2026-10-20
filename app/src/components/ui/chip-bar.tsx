import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Horizontal filter chips (one selected). */
export function ChipBar<T extends string>({
  options,
  value,
  onChange,
  onBand = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Drawn inside the colored header band (white chips) instead of on the page. */
  onBand?: boolean;
}) {
  const { colors } = useTheme();
  const bar = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange(option);
            }}
            style={[styles.chip, { backgroundColor: onBand ? (selected ? '#FFFFFF' : 'rgba(255,255,255,0.22)') : selected ? colors.primary : colors.card }]}>
            <Text variant="subhead" style={{ color: onBand ? (selected ? colors.banner : '#FFFFFF') : selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
  // The header band ends where the large title ends: this strip extends it behind the chips.
  return onBand ? <View style={[styles.band, { backgroundColor: colors.banner }]}>{bar}</View> : bar;
}

const styles = StyleSheet.create({
  band: {},
  bar: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center' },
});
