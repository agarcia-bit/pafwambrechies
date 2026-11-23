import { Stack } from 'expo-router';

import { entourerDUneZoneDeLecture } from '@/components/zone-de-lecture';

import { useBrandHeader } from '@/theme';

export default function AnnuaireLayout() {
  const header = useBrandHeader();
  return (
    <Stack screenOptions={header} screenLayout={entourerDUneZoneDeLecture}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
