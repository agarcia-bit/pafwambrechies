import { Stack } from 'expo-router';

import { useBrandHeader } from '@/theme';

import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';

export default function PlusLayout() {
  const header = useBrandHeader();
  const { isAdmin, isBureau, isPlatformAdmin } = useMember();
  const { modules, cotisations } = useTenantConfig();
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
      <Stack.Protected guard={modules.offres}>
        <Stack.Screen name="mes-offres/index" options={{ title: 'Mes offres' }} />
        <Stack.Screen name="mes-offres/edit" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={modules.annuaire}>
        <Stack.Screen name="ma-fiche" options={{ title: 'Ma fiche', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={isPlatformAdmin}>
        <Stack.Screen name="associations" options={{ title: 'Associations' }} />
      </Stack.Protected>
      <Stack.Screen name="regles" options={{ title: 'Règles de la communauté' }} />
      <Stack.Screen name="bloques" options={{ title: 'Membres bloqués' }} />
      <Stack.Screen name="compte" options={{ title: 'Mon compte' }} />
      {/* The RLS policies enforce it server-side; this hides the screens from other members. */}
      <Stack.Protected guard={isBureau}>
        <Stack.Screen name="admin/index" options={{ title: 'Administration' }} />
        <Stack.Screen name="admin/[collection]/index" options={{ title: '' }} />
        <Stack.Screen name="admin/[collection]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin/idees" options={{ title: 'Idées' }} />
        <Stack.Screen name="admin/signalements" options={{ title: 'Signalements' }} />
        <Stack.Screen name="admin/sondages/index" options={{ title: 'Sondages' }} />
        <Stack.Screen name="admin/sondages/nouveau" options={{ title: 'Nouveau sondage', presentation: 'modal' }} />
        <Stack.Screen name="admin/sondages/[id]" options={{ title: 'Résultats' }} />
        <Stack.Screen name="admin/participants" options={{ title: 'Réponses' }} />
      </Stack.Protected>
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin/reglages" options={{ title: 'Réglages' }} />
        <Stack.Screen name="admin/membres" options={{ title: 'Membres' }} />
      </Stack.Protected>
      <Stack.Protected guard={isBureau && cotisations.enabled}>
        <Stack.Screen name="admin/cotisations" options={{ title: 'Cotisations' }} />
        <Stack.Screen name="admin/cotisations-reglages" options={{ title: 'Campagne et paiement' }} />
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
