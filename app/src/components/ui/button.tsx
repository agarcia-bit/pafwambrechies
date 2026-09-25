import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }: ButtonProps) {
  const { colors } = useTheme();
  const { background, foreground } = {
    primary: { background: colors.primary, foreground: colors.onPrimary },
    secondary: { background: colors.primarySoft, foreground: colors.primary },
    plain: { background: 'transparent', foreground: colors.primary },
    destructive: { background: colors.fill, foreground: colors.danger },
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
        variant === 'plain' && styles.plain,
        { backgroundColor: background, opacity: inactive ? 0.5 : pressed ? 0.7 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={18} color={foreground} />}
          <Text variant="headline" style={{ color: foreground }}>
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
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
