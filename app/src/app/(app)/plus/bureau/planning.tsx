import { Stack, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/form-screen';
import { DemarrerLePlanning, GrilleDuPlanning, PolesDuPlanning, ReglagesDuPlanning } from '@/components/planning-bureau';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { messageDuPlanning, useModifierLePlanning, usePlanning } from '@/lib/planning';

/** Le planning des présences d'une action, sur le téléphone d'un membre du bureau. */
export default function PlanningScreen() {
  const { action, titre } = useLocalSearchParams<{ action: string; titre?: string }>();
  const actionId = Number(action);
  const planning = usePlanning(actionId);
  const modification = useModifierLePlanning(actionId);

  if (planning.isPending) return <LoadingState />;
  if (planning.isError) return <ErrorState onRetry={planning.refetch} />;
  const { horaires, ouvert, poles } = planning.data;
  return (
    <>
      <Stack.Screen options={{ title: titre || 'Planning' }} />
      <FormScreen>
        {modification.isError && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(modification.error)}</Text>}
        {horaires ? (
          <>
            <ReglagesDuPlanning key={`${horaires.debut}-${horaires.fin}`} horaires={horaires} ouvert={ouvert} modifier={modification.mutate} />
            <PolesDuPlanning poles={poles} modifier={modification.mutate} />
            <GrilleDuPlanning actionId={actionId} planning={{ ...planning.data, horaires }} />
          </>
        ) : (
          <DemarrerLePlanning modifier={modification.mutate} />
        )}
      </FormScreen>
    </>
  );
}
