import { router, Stack, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/form-screen';
import { ListRow, ListSection } from '@/components/ui/list';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { confirmAction, showMessage } from '@/lib/confirm';
import { libelleDeTranche } from '@/lib/creneaux';
import { useEchange } from '@/lib/echanges-creneaux';
import { casesDuPole, usePlanningsOuverts } from '@/lib/mes-creneaux';
import { messageDuPlanning } from '@/lib/planning';

/**
 * « Proposer un échange » depuis son billet : choisir un autre créneau de la même action. Les
 * personnes inscrites sur ce créneau reçoivent la proposition ; la première qui accepte échange.
 */
export default function EchangeScreen() {
  const { action, inscription } = useLocalSearchParams<{ action: string; inscription: string }>();
  const plannings = usePlanningsOuverts();
  const { proposer } = useEchange();
  const planning = plannings.data?.find((p) => p.id === Number(action));
  const mienne = planning?.poles.flatMap((p) => p.mes_inscriptions.map((i) => ({ ...i, pole: p }))).find((i) => i.id === Number(inscription));
  if (plannings.isPending) return <LoadingState />;
  if (!planning || !mienne) return <EmptyState icon="calendar" title="Créneau introuvable" message="Il a peut-être déjà changé." />;
  const duree = planning.duree_minutes;

  async function choisir(pole: { id: number; nom: string }, heure: string) {
    const ok = await confirmAction({
      title: 'Proposer cet échange ?',
      message: `Votre créneau (${mienne!.pole.nom}, ${libelleDeTranche(mienne!.debut, duree)}) contre ${pole.nom}, ${libelleDeTranche(heure, duree)}. Les personnes inscrites sur ce créneau le verront, sans savoir qui le propose.`,
      confirmLabel: 'Proposer',
    });
    if (!ok) return;
    proposer.mutate({ inscription: mienne!.id, pole: pole.id, heure }, {
      onSuccess: () => { router.back(); showMessage('Échange proposé', 'Vous serez prévenu dès que quelqu’un accepte.'); },
      onError: (e) => showMessage('Échange impossible', messageDuPlanning(e)),
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Proposer un échange' }} />
      <FormScreen>
        <Text tone="secondary">Votre créneau : {mienne.pole.nom}, {libelleDeTranche(mienne.debut, duree)}. Contre lequel l’échanger ?</Text>
        {planning.poles.map((pole) => {
          // Un créneau où quelqu'un est déjà inscrit : c'est avec cette personne qu'on échange.
          const cases = casesDuPole(planning, pole).filter((c) => c.etat !== 'vous' && (pole.pris[c.heure] ?? 0) > 0);
          if (!cases.length) return null;
          return (
            <ListSection key={pole.id} title={pole.nom}>
              {cases.map((c) => (
                <ListRow key={c.heure} title={libelleDeTranche(c.heure, duree)} subtitle={c.libres ? 'Il reste aussi de la place : vous pouvez vous y inscrire directement' : 'Complet'}
                  onPress={() => choisir(pole, c.heure)} />
              ))}
            </ListSection>
          );
        })}
      </FormScreen>
    </>
  );
}
