import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';

export default function PlusLayout() {
  const header = useBrandHeader();
  const { isAdmin, isBureau } = useMember();
  const { modules } = useTenantConfig();
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={modules.idees}>
        <Stack.Screen name="idees/index" options={{ title: 'Boîte à idées' }} />
        <Stack.Screen name="idees/[id]" options={{ title: '' }} />
        <Stack.Screen name="idees/nouvelle" options={{ title: 'Nouvelle idée', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={modules.liens}>
        <Stack.Screen name="liens" options={{ title: 'Liens utiles' }} />
      </Stack.Protected>
      <Stack.Screen name="compte" options={{ title: 'Mon compte' }} />
      {/* The RLS policies enforce it server-side; this hides the screens from other members. */}
      <Stack.Protected guard={isBureau}>
        <Stack.Screen name="admin/index" options={{ title: 'Administration' }} />
        <Stack.Screen name="admin/[collection]/index" options={{ title: '' }} />
        <Stack.Screen name="admin/[collection]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin/idees" options={{ title: 'Idées' }} />
        <Stack.Screen name="admin/sondages/index" options={{ title: 'Sondages' }} />
        <Stack.Screen name="admin/sondages/nouveau" options={{ title: 'Nouveau sondage', presentation: 'modal' }} />
        <Stack.Screen name="admin/sondages/[id]" options={{ title: 'Résultats' }} />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin/reglages" options={{ title: 'Réglages' }} />
        <Stack.Screen name="admin/membres" options={{ title: 'Membres' }} />
      </Stack.Protected>
      <Stack.Protected guard={isBureau}>
        <Stack.Screen name="bureau/index" options={{ title: 'Pilotage bureau' }} />
        <Stack.Screen name="bureau/action/[id]" options={{ title: 'Action' }} />
        <Stack.Screen name="bureau/action/nouvelle" options={{ title: 'Nouvelle action', presentation: 'modal' }} />
        <Stack.Screen name="bureau/tache" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
