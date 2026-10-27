import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { daysUntil } from '@/lib/format';
import { REPONSE_LABELS, useAnswerEvenement, useMyReponses, type Reponse } from '@/lib/participation';
import { useMember } from '@/lib/session';
import type { Evenement } from '@/lib/types';

const CHOICES: Reponse[] = ['present', 'absent', 'indecis'];

/** Answers "do you come?" with one tap; the choice can be changed until the day of the event. */
export function useAnswerHandler() {
  const answer = useAnswerEvenement();
  return {
    pending: answer.isPending ? answer.variables : undefined,
    send(evenementId: number, reponse: Reponse, onDone?: () => void) {
      answer.mutate(
        { evenementId, reponse },
        {
          onSuccess: () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone?.();
          },
          onError: () => showMessage('Réponse non envoyée', 'Vérifiez votre connexion et réessayez.'),
        }
      );
    },
  };
}

/** "Do you come?" block of the event page, and for the bureau a way to see who answered. */
export function ParticipationBlock({ event: ev }: { event: Evenement }) {
  const { isBureau } = useMember();
  const mine = useMyReponses();
  const { pending, send } = useAnswerHandler();
  if (!ev.participation) return null;

  const current = mine.data?.[ev.id];
  const open = daysUntil(ev.date) >= 0;

  return (
    <View style={styles.block}>
      <Text variant="headline">Venez-vous ?</Text>
      {open ? (
        <View style={styles.choices}>
          {CHOICES.map((reponse) => (
            <Button
              key={reponse}
              title={REPONSE_LABELS[reponse]}
              variant={current === reponse ? 'primary' : 'secondary'}
              icon={current === reponse ? 'checkCircle' : undefined}
              loading={pending?.evenementId === ev.id && pending.reponse === reponse}
              onPress={() => send(ev.id, reponse)}
            />
          ))}
        </View>
      ) : (
        <Text tone="secondary">Les réponses sont closes.</Text>
      )}
      {isBureau && (
        <Button
          title="Voir les réponses"
          icon="people"
          variant="plain"
          onPress={() => router.push({ pathname: '/plus/admin/participants', params: { id: String(ev.id) } })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  choices: { gap: 8 },
});
