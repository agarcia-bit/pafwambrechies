import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

import { useTenantConfig } from '@/lib/tenant-config';

export default function OffresLayout() {
  const header = useBrandHeader();
  const { labels } = useTenantConfig();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: labels.offres, headerLargeTitleEnabled: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
