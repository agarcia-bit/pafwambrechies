import { Stack } from 'expo-router';

import { useTenantConfig } from '@/lib/tenant-config';

export default function AnnuaireLayout() {
  const { labels } = useTenantConfig();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: labels.annuaire, headerLargeTitleEnabled: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
