import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { FormScreen } from '@/components/form-screen';

/** The teal of the logo: gradient of the sign-in screens (the header of their screens matches its top). */
export const AUTH_GRADIENT = ['#14B8A6', '#0B5F58'] as const;
export const AUTH_HEADER_COLOR = AUTH_GRADIENT[0];

/** Text colors on the gradient. */
export const authText = StyleSheet.create({
  title: { color: '#FFFFFF' },
  body: { color: 'rgba(255,255,255,0.88)' },
  error: { color: '#FFE4E1', fontWeight: '600' },
});

/** A sign-in form on the logo's teal gradient, white text and fields. */
export function AuthScreen({
  children,
  fullScreen,
  style,
}: {
  children: ReactNode;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient colors={AUTH_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <StatusBar style="light" />
      <FormScreen transparent fullScreen={fullScreen} style={style}>
        {children}
      </FormScreen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
