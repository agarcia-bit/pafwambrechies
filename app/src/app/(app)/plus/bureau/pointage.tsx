import { Stack, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/form-screen';
import { TrancheDuPointage } from '@/components/pointage';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { messageDuPlanning, useModifierLePlanning, usePlanning } from '@/lib/planning';
import { phraseDuPointage, resumeDuPointage, tranchesAPointer } from '@/lib/pointage';

/**
 * Le jour J, sur le téléphone du responsable : qui est vraiment venu. Un toucher par personne,
 * rangées par heure d'arrivée ; sans pointage, l'inscription compte comme tenue.
 */
export default function PointageScreen() {
  const { action } = useLocalSearchParams<{ action: string }>();
  const actionId = Number(action);
  const planning = usePlanning(actionId);
  const modification = useModifierLePlanning(actionId);

  if (planning.isPending) return <LoadingState />;
  if (planning.isError) return <ErrorState onRetry={planning.refetch} />;
  const { horaires, inscrits } = planning.data;
  if (!horaires || !inscrits.length) return <EmptyState title="Personne à pointer" message="Aucun inscrit sur ce planning." />;
  return (
    <>
      <Stack.Screen options={{ title: 'Pointage' }} />
      <FormScreen>
        <Text variant="headline" accessibilityLiveRegion="polite">{phraseDuPointage(resumeDuPointage(inscrits))}</Text>
        <Text variant="footnote" tone="secondary">Touchez « Venu » ou « Absent ». Retouchez pour annuler. Sans pointage, la personne compte comme venue.</Text>
        {modification.isError && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(modification.error)}</Text>}
        {tranchesAPointer(planning.data, horaires.dureeMinutes).map((tranche) => (
          <TrancheDuPointage key={tranche.heure} tranche={tranche} enCours={modification.isPending}
            onPointer={(inscrit, presence) => modification.mutate({ type: 'pointer', inscrit, presence })} />
        ))}
      </FormScreen>
    </>
  );
}
