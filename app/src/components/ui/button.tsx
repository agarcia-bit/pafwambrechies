import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive' | 'light' | 'glass' | 'lightPlain';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Smaller, for actions inside a card. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, compact, style }: ButtonProps) {
  const { colors } = useTheme();
  const { background, foreground } = {
    primary: { background: colors.primary, foreground: colors.onPrimary },
    secondary: { background: colors.primarySoft, foreground: colors.primary },
    plain: { background: 'transparent', foreground: colors.primary },
    destructive: { background: colors.fill, foreground: colors.danger },
    // On a colored background: white button, translucent button, plain white text.
    light: { background: '#FFFFFF', foreground: '#0B5F58' },
    glass: { background: 'rgba(255,255,255,0.2)', foreground: '#FFFFFF' },
    lightPlain: { background: 'transparent', foreground: '#FFFFFF' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (variant === 'plain' || variant === 'lightPlain') && styles.plain,
        compact && styles.compact,
        { backgroundColor: background, opacity: inactive ? 0.5 : pressed ? 0.7 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={compact ? 16 : 18} color={foreground} />}
          <Text variant={compact ? 'subhead' : 'headline'} style={{ color: foreground, fontWeight: '600' }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: { minHeight: 44 },
  compact: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
