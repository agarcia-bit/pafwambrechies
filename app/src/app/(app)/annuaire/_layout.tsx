import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

import { useTenantConfig } from '@/lib/tenant-config';

export default function AnnuaireLayout() {
  const header = useBrandHeader();
  const { labels } = useTenantConfig();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: labels.annuaire, headerLargeTitleEnabled: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
