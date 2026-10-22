import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

export function TextField({
  label,
  style,
  multiline,
  onDark = false,
  ...props
}: TextInputProps & {
  label: string;
  /** On a colored background: light label, white field. */
  onDark?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="footnote" tone="secondary" style={[styles.label, onDark && styles.labelOnDark]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={onDark ? '#8A8A8E' : colors.textSecondary}
        selectionColor={colors.primary}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          onDark ? { backgroundColor: '#FFFFFF', color: '#000000' } : { backgroundColor: colors.fill, color: colors.text },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { marginLeft: 4 },
  labelOnDark: { color: 'rgba(255,255,255,0.85)' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
});
