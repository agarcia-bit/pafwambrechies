import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BilletDeCreneau } from '@/components/billet-de-creneau';

import { FormScreen } from '@/components/form-screen';
import { DemarrerLePlanning, GrilleDuPlanning, PolesDuPlanning, ReglagesDuPlanning } from '@/components/planning-bureau';
import { Badge } from '@/components/ui/badge';
import { ListRow, ListSection } from '@/components/ui/list';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { confirmAction } from '@/lib/confirm';
import { billetsDeLaPersonne } from '@/lib/creneaux';
import { messageDuPlanning, useModifierLePlanning, usePlanning, type Inscrit } from '@/lib/planning';
import { useMember } from '@/lib/session';

/**
 * Le planning des présences d'une action, sur le téléphone d'un membre du bureau : ses créneaux
 * en billets, puis la grille, puis les réglages (horaires, pôles) repliés une fois prêts.
 */
export default function PlanningScreen() {
  const { action, titre } = useLocalSearchParams<{ action: string; titre?: string }>();
  const actionId = Number(action);
  const { profile } = useMember();
  const planning = usePlanning(actionId);
  const modification = useModifierLePlanning(actionId);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  if (planning.isPending) return <LoadingState />;
  if (planning.isError) return <ErrorState onRetry={planning.refetch} />;
  const { horaires, ouvert, poles } = planning.data;
  const estPret = !!horaires && poles.length > 0;
  async function seRetirer(inscrit: Inscrit) {
    const ok = await confirmAction({ title: 'Vous ne pouvez plus venir ?', message: 'La place redeviendra libre.', confirmLabel: 'Me désinscrire', destructive: true });
    if (ok) modification.mutate({ type: 'je-me-retire', inscrit });
  }
  return (
    <>
      <Stack.Screen options={{ title: titre || 'Planning' }} />
      <FormScreen>
        {modification.isError && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(modification.error)}</Text>}
        {!horaires && <DemarrerLePlanning modifier={modification.mutate} />}
        {horaires && estPret && (
          <>
            <Badge label={ouvert ? 'Ouvert aux membres' : 'Réservé au bureau'} />
            {billetsDeLaPersonne(poles, planning.data.inscrits, profile.id).map(({ inscrit, nomDuPole, avec }) => (
              <BilletDeCreneau key={inscrit.id} nomDuPole={nomDuPole} heure={inscrit.debut} dureeMinutes={horaires.dureeMinutes}
                autres={avec.length} estNouveau={false} enCours={modification.isPending} onLiberer={() => seRetirer(inscrit)} />
            ))}
            <GrilleDuPlanning actionId={actionId} moi={profile.id} planning={{ ...planning.data, horaires }} />
          </>
        )}
        {horaires && (estPret && !reglagesOuverts ? (
          <ListSection>
            <ListRow icon="gear" title="Horaires et pôles" subtitle="Modifier le découpage de la journée ou les pôles" onPress={() => setReglagesOuverts(true)} />
          </ListSection>
        ) : (
          <>
            <ReglagesDuPlanning key={`${horaires.debut}-${horaires.fin}`} horaires={horaires} ouvert={ouvert} modifier={modification.mutate} />
            <PolesDuPlanning poles={poles} modifier={modification.mutate} />
          </>
        ))}
      </FormScreen>
    </>
  );
}
