import { Stack } from 'expo-router';

import { useBrandHeader, useTheme } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { backgroundColor: colors.banner } }} />
      {/* The post opens over the whole screen, rising from the bottom. */}
      <Stack.Screen
        name="actu/[id]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.card },
        }}
      />
    </Stack>
  );
}
