import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="actu/[id]" options={{ title: '' }} />
    </Stack>
  );
}
