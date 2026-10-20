import { Stack } from 'expo-router';

import { useBrandHeader, useTheme } from '@/theme';

export default function OffresLayout() {
  const header = useBrandHeader();
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ ...header, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.card } }}
      />
    </Stack>
  );
}
