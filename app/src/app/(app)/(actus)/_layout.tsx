import { Stack } from 'expo-router';

import { useBrandHeader, useTheme } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ ...header, headerShown: false }}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.banner } }} />
      {/* The post opens over the whole screen, rising from the bottom. */}
      <Stack.Screen
        name="actu/[id]"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.card },
        }}
      />
    </Stack>
  );
}
