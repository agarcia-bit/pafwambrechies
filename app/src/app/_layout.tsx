import { QueryClientProvider } from '@tanstack/react-query';
import { Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AUTH_HEADER_COLOR } from '@/components/auth-screen';
import { queryClient } from '@/lib/query';
import { SessionProvider, useSession } from '@/lib/session';
import { AppThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Header of the sign-in screens: the teal of the gradient behind them, white title.
const authHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: AUTH_HEADER_COLOR },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { color: '#FFFFFF' },
  headerShadowVisible: false,
} as const;

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading, recovery, membership, membershipError } = useSession();
  const [fontsLoaded, fontError] = useFonts({ Sora_700Bold, Sora_800ExtraBold });
  // Keep the splash screen until we know the screen to show, its colors and the title font.
  const ready =
    !isLoading && (fontsLoaded || !!fontError) && (!session || membership !== undefined || membershipError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (isLoading || !(fontsLoaded || fontError)) return null;

  return (
    <AppThemeProvider brandColor={membership?.branding?.tenant_primary_color}
      bannerColor={membership?.branding?.tenant_secondary_color}>
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Protected guard={!!session && !recovery}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && recovery}>
          <Stack.Screen name="nouveau-mot-de-passe" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="connexion" />
          <Stack.Screen name="inscription" options={{ ...authHeader, title: 'Créer mon compte' }} />
          <Stack.Screen name="mot-de-passe-oublie" options={{ ...authHeader, title: 'Mot de passe oublié' }} />
        </Stack.Protected>
      </Stack>
    </AppThemeProvider>
  );
}
