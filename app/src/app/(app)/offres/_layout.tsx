import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

export default function OffresLayout() {
  const header = useBrandHeader();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
