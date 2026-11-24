import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BilletDeCreneau } from '@/components/billet-de-creneau';
import { FormScreen } from '@/components/form-screen';
import { DemarrerLePlanning, GrilleDuPlanning, PolesDuPlanning, ReglagesDuPlanning } from '@/components/planning-bureau';
import { EnteteDuPlanning, ListeDesTrous } from '@/components/planning-trous';
import { BilanDeLaJournee, EntreeDuPointage } from '@/components/pointage';
import { ChipBar } from '@/components/ui/chip-bar';
import { ListRow, ListSection } from '@/components/ui/list';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { confirmAction } from '@/lib/confirm';
import { billetsDeLaPersonne, messageDeRelance, tranchesDeLaJournee, trousDuPlanning, type Horaires } from '@/lib/creneaux';
import { formatDayLong } from '@/lib/format';
import { useDerniereRelance } from '@/lib/relance';
import { messageDuPlanning, useModifierLePlanning, usePlanning, type Inscrit, type Planning } from '@/lib/planning';
import { estActionPassee, jourLocal, peutPointer } from '@/lib/pointage';
import { useMember } from '@/lib/session';

/**
 * Le planning des présences d'une action, sur le téléphone d'un membre du bureau, comme la page de
 * l'espace bureau : ce qui manque d'abord (phrase, « Ouvrir aux membres », liste des trous), ses
 * créneaux en billets, tout le planning à la demande, et les réglages repliés une fois prêts.
 * Une fois la date passée, on ne cherche plus de monde : le bilan de la journée et le pointage.
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
  const { horaires, poles } = planning.data;
  const estPret = !!horaires && poles.length > 0;
  const estPassee = estActionPassee(planning.data.date, jourLocal());
  return (
    <>
      <Stack.Screen options={{ title: titre || 'Planning' }} />
      <FormScreen>
        {modification.isError && <Text tone="danger" accessibilityLiveRegion="polite">{messageDuPlanning(modification.error)}</Text>}
        {!horaires && <DemarrerLePlanning modifier={modification.mutate} />}
        {horaires && estPret && (estPassee ? (
          <>
            <BilanDeLaJournee actionId={actionId} inscrits={planning.data.inscrits} />
            <GrilleDuPlanning actionId={actionId} moi={profile.id} planning={{ ...planning.data, horaires }} />
          </>
        ) : <PlanningEnCours actionId={actionId} planning={planning.data} horaires={horaires} />)}
        {horaires && (estPret && !reglagesOuverts ? (
          <ListSection>
            <ListRow icon="gear" title="Horaires et pôles" subtitle="Modifier le découpage de la journée ou les pôles" onPress={() => setReglagesOuverts(true)} />
          </ListSection>
        ) : (
          <>
            <ReglagesDuPlanning key={`${horaires.debut}-${horaires.fin}`} horaires={horaires} modifier={modification.mutate} />
            <PolesDuPlanning poles={poles} modifier={modification.mutate} />
          </>
        ))}
      </FormScreen>
    </>
  );
}

const VUES = ['Ce qui manque', 'Tout le planning'] as const;

/** Avant l'action et le jour J : ce qui manque, prévenir les membres, ses créneaux, puis le planning. */
function PlanningEnCours({ actionId, planning, horaires }: { actionId: number; planning: Planning; horaires: Horaires }) {
  const { profile } = useMember();
  const modification = useModifierLePlanning(actionId);
  const derniereRelance = useDerniereRelance(actionId);
  const [vue, setVue] = useState<(typeof VUES)[number]>('Ce qui manque');
  const trous = trousDuPlanning(planning.poles, tranchesDeLaJournee(horaires), planning.inscrits, profile.id);
  async function seRetirer(inscrit: Inscrit) {
    const ok = await confirmAction({ title: 'Vous ne pouvez plus venir ?', message: 'La place redeviendra libre.', confirmLabel: 'Me désinscrire', destructive: true });
    if (ok) modification.mutate({ type: 'je-me-retire', inscrit });
  }
  return (
    <>
      <EnteteDuPlanning trous={trous} ouvert={planning.ouvert} modifier={modification.mutate} enCours={modification.isPending}
        derniereRelance={derniereRelance.data ?? null}
        onPrevenir={() => router.push({ pathname: '/plus/bureau/relance', params: {
          action: String(actionId), ouvert: planning.ouvert ? '1' : '0',
          message: messageDeRelance(planning.titre, formatDayLong(planning.date).toLowerCase(), trous, horaires.dureeMinutes),
        } })} />
      {billetsDeLaPersonne(planning.poles, planning.inscrits, profile.id).map(({ inscrit, nomDuPole, avec }) => (
        <BilletDeCreneau key={inscrit.id} nomDuPole={nomDuPole} heure={inscrit.debut} dureeMinutes={horaires.dureeMinutes}
          autres={avec.length} estNouveau={false} enCours={modification.isPending} onLiberer={() => seRetirer(inscrit)} compact />
      ))}
      {peutPointer(planning.date, jourLocal()) && <EntreeDuPointage actionId={actionId} inscrits={planning.inscrits} />}
      <ChipBar options={VUES} value={vue} onChange={setVue} />
      {vue === 'Ce qui manque'
        ? <ListeDesTrous actionId={actionId} trous={trous} planning={planning} moi={profile.id} modifier={modification.mutate} />
        : <GrilleDuPlanning actionId={actionId} moi={profile.id} planning={{ ...planning, horaires }} />}
    </>
  );
}
