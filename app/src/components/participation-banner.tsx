import { router } from 'expo-router';

import { AlertStrip } from '@/components/alert-strip';
import { useParticipationQueue } from '@/lib/participation';

/**
 * Thin red strip at the top of the home feed while an event within a week asks "do you come?"
 * and the member has not settled it. One event opens its page; several open the Agenda.
 */
export function ParticipationBanner() {
  const { pending } = useParticipationQueue();
  if (!pending.length) return null;
  const [first] = pending;

  return (
    <AlertStrip
      icon="calendar"
      title={pending.length === 1 ? `${first.titre} : vous venez ?` : `${pending.length} événements : vous venez ?`}
      hint="Ouvre l’événement pour répondre"
      onPress={() =>
        pending.length === 1
          ? router.push({ pathname: '/agenda/[id]', params: { id: String(first.id) } })
          : router.navigate('/agenda')
      }
    />
  );
}
