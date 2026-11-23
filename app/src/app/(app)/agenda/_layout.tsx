import { Stack } from 'expo-router';

import { entourerDUneZoneDeLecture } from '@/components/zone-de-lecture';

import { useBrandHeader, useTheme } from '@/theme';

export default function AgendaLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ ...header, headerShown: false }} screenLayout={entourerDUneZoneDeLecture}>
      <Stack.Screen name="index" />
      <Stack.Screen name="creneaux/[action]" options={{ headerShown: true, title: 'Planning' }} />
      <Stack.Screen name="proposer" options={{ headerShown: true, title: 'Proposer un événement', presentation: 'modal' }} />
      <Stack.Screen
        name="[id]"
        options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.card } }}
      />
    </Stack>
  );
}
