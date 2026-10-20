import { Stack } from 'expo-router';

import { useBrandHeader, useTheme } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { backgroundColor: colors.banner } }} />
      <Stack.Screen name="actu/[id]" options={{ title: '' }} />
    </Stack>
  );
}
