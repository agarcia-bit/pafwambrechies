import { Stack } from 'expo-router';

import { entourerDUneZoneDeLecture } from '@/components/zone-de-lecture';
import { useBrandHeader, useTheme } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ ...header, headerShown: false }} screenLayout={entourerDUneZoneDeLecture}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.background } }} />
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
