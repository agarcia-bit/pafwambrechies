import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme';

// iOS text styles (size / line height), scaled by Dynamic Type.
const VARIANTS = StyleSheet.create({
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24 },
  callout: { fontSize: 16, lineHeight: 21 },
  subhead: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
});

export type TextVariant = keyof typeof VARIANTS;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: 'default' | 'secondary' | 'primary' | 'danger';
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    secondary: colors.textSecondary,
    primary: colors.primary,
    danger: colors.danger,
  }[tone];
  return <RNText style={[VARIANTS[variant], { color }, style]} {...rest} />;
}
