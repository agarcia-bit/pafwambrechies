import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

/** Scrollable form that stays above the keyboard. */
export function FormScreen({
  children,
  style,
  fullScreen = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** No navigation header: the screen handles the safe areas itself (login). */
  fullScreen?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, style]}
      contentInsetAdjustmentBehavior={fullScreen ? 'never' : 'automatic'}
      automaticallyAdjustKeyboardInsets
      alwaysBounceVertical={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, flexGrow: 1 },
});
