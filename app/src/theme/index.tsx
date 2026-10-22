import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { createContext, use, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makePalette, type Palette, type Scheme } from '@/theme/colors';

type Theme = { colors: Palette; scheme: Scheme };

const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside AppThemeProvider');
  return theme;
}

function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** App-wide theme: navigation colors and our palette, tinted with the association color. */
export function AppThemeProvider({
  brandColor,
  bannerColor,
  children,
}: PropsWithChildren<{ brandColor?: string | null; bannerColor?: string | null }>) {
  const scheme = useScheme();
  const colors = makePalette(scheme, brandColor, bannerColor);
  const nav = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeContext value={{ colors, scheme }}>
      <ThemeProvider
        value={{
          ...nav,
          colors: {
            ...nav.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.separator,
          },
        }}>
        {children}
      </ThemeProvider>
    </ThemeContext>
  );
}

/** Tints a part of a screen with another association's color (signup preview). */
export function BrandScope({ color, banner, children }: PropsWithChildren<{ color?: string | null; banner?: string | null }>) {
  const scheme = useScheme();
  return <ThemeContext value={{ colors: makePalette(scheme, color, banner), scheme }}>{children}</ThemeContext>;
}

/** Header options giving every screen the association's colored band with white titles. */
export function useBrandHeader() {
  const { colors } = useTheme();
  return {
    headerBackButtonDisplayMode: 'minimal' as const,
    headerTintColor: '#FFFFFF',
    headerStyle: { backgroundColor: colors.banner },
    headerTitleStyle: { color: '#FFFFFF' },
    headerLargeStyle: { backgroundColor: colors.banner },
    headerLargeTitleStyle: { color: '#FFFFFF' },
    headerShadowVisible: false,
  };
}

/** Style for a screen whose list starts with a BrandBand: the list reaches up under the status bar. */
export function useBandListStyle() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return { backgroundColor: colors.background, marginTop: -insets.top };
}
