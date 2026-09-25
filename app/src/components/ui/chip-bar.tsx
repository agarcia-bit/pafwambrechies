import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Horizontal filter chips (one selected). */
export function ChipBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
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
            style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card }]}>
            <Text variant="subhead" style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center' },
});
