import { Stack } from 'expo-router';

import { useMember } from '@/lib/session';
import { useBrandHeader } from '@/theme';

export default function ActusLayout() {
  const header = useBrandHeader();
  const { branding } = useMember();
  const name = (branding?.tenant_name ?? branding?.name ?? 'Actus').toUpperCase();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ title: name, headerLargeTitleEnabled: true }} />
      <Stack.Screen name="actu/[id]" options={{ title: '' }} />
    </Stack>
  );
}
