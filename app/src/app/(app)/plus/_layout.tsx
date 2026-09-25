import { Stack } from 'expo-router';

import { useMember } from '@/lib/session';

export default function PlusLayout() {
  const { isAdmin, isBureau } = useMember();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Plus', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="idees/index" options={{ title: 'Boîte à idées', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="idees/[id]" options={{ title: '' }} />
      <Stack.Screen name="idees/nouvelle" options={{ title: 'Nouvelle idée', presentation: 'modal' }} />
      <Stack.Screen name="liens" options={{ title: 'Liens utiles', headerLargeTitleEnabled: true }} />
      <Stack.Screen name="compte" options={{ title: 'Mon compte', headerLargeTitleEnabled: true }} />
      {/* The RLS policies enforce it server-side; this hides the screens from other members. */}
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin/index" options={{ title: 'Administration', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="admin/[collection]/index" options={{ headerLargeTitleEnabled: true }} />
        <Stack.Screen name="admin/[collection]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin/idees" options={{ title: 'Idées', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="admin/reglages" options={{ title: 'Réglages', headerLargeTitleEnabled: true }} />
      </Stack.Protected>
      <Stack.Protected guard={isBureau}>
        <Stack.Screen name="bureau/index" options={{ title: 'Pilotage bureau', headerLargeTitleEnabled: true }} />
        <Stack.Screen name="bureau/action/[id]" options={{ title: 'Action' }} />
        <Stack.Screen name="bureau/action/nouvelle" options={{ title: 'Nouvelle action', presentation: 'modal' }} />
        <Stack.Screen name="bureau/tache" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
