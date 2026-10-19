import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

export default function AgendaLayout() {
  const header = useBrandHeader();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: 'Agenda', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
