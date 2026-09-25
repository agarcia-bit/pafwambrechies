import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { queryClient } from '@/lib/query';
import { SessionProvider, useSession } from '@/lib/session';
import { AppThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();

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
  // Keep the splash screen until we know the screen to show and its colors.
  const ready = !isLoading && (!session || membership !== undefined || membershipError);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (isLoading) return null;

  return (
    <AppThemeProvider brandColor={membership?.branding?.tenant_primary_color}>
      <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Protected guard={!!session && !recovery}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && recovery}>
          <Stack.Screen name="nouveau-mot-de-passe" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="connexion" />
          <Stack.Screen name="inscription" options={{ headerShown: true, title: 'Créer mon compte' }} />
          <Stack.Screen name="mot-de-passe-oublie" options={{ headerShown: true, title: 'Mot de passe oublié' }} />
        </Stack.Protected>
      </Stack>
    </AppThemeProvider>
  );
}
