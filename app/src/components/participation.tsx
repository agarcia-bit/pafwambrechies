import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ChoixDesJours } from '@/components/choix-des-jours';
import { useCouleursDeReponse } from '@/components/couleurs-de-reponse';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { showMessage } from '@/lib/confirm';
import { daysUntil } from '@/lib/format';
import {
  REPONSE_LABELS,
  useAnswerEvenement,
  useMyReponses,
  type MaReponse,
  type Reponse,
  type ReponseAEnvoyer,
} from '@/lib/participation';
import { dernierJour, estSurPlusieursJours, resumerJoursChoisis } from '@/lib/periode';
import { useMember } from '@/lib/session';
import type { Evenement } from '@/lib/types';
import { useTheme } from '@/theme';

const CHOICES: Reponse[] = ['present', 'absent', 'indecis'];

/** Answers "do you come?" with one tap; the choice can be changed until the last day of the event. */
export function useAnswerHandler() {
  const answer = useAnswerEvenement();
  return {
    pending: answer.isPending ? answer.variables : undefined,
    send(reponse: ReponseAEnvoyer, onDone?: () => void) {
      answer.mutate(reponse, {
        onSuccess: () => {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone?.();
        },
        onError: () => showMessage('Réponse non envoyée', 'Vérifiez votre connexion et réessayez.'),
      });
    },
  };
}

/** « Réponse enregistrée » s'affiche quelques secondes après chaque envoi. */
function useConfirmationBreve() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [visible]);
  return { visible, montrer: () => setVisible(true) };
}

/** "Do you come?" block of the event page, and for the bureau a way to see who answered. */
export function ParticipationBlock({ event: ev }: { event: Evenement }) {
  const { isBureau } = useMember();
  const mine = useMyReponses();
  const { pending, send } = useAnswerHandler();
  const confirmation = useConfirmationBreve();
  const couleurs = useCouleursDeReponse();
  // Pour un événement sur plusieurs jours, « Présent » ouvre d'abord le choix des jours.
  const [choixOuvert, setChoixOuvert] = useState(false);
  if (!ev.participation) return null;

  const current = mine.data?.[ev.id];
  const open = daysUntil(dernierJour(ev)) >= 0;
  const plusieursJours = estSurPlusieursJours(ev);
  const envoyer = (reponse: Omit<ReponseAEnvoyer, 'evenementId'>) =>
    send({ evenementId: ev.id, ...reponse }, () => {
      setChoixOuvert(false);
      confirmation.montrer();
    });

  return (
    <View style={styles.block}>
      <Text variant="headline">Venez-vous ?</Text>
      {!open ? (
        <Text tone="secondary">Les réponses sont closes.</Text>
      ) : choixOuvert ? (
        <ChoixDesJours
          event={ev}
          depart={current?.reponse === 'present' ? current : undefined}
          enCours={pending?.evenementId === ev.id}
          onValider={(choix) => envoyer({ reponse: 'present', ...choix })}
          onAnnuler={() => setChoixOuvert(false)}
        />
      ) : (
        <View style={styles.choices}>
          {CHOICES.map((reponse) => (
            <Button
              key={reponse}
              title={REPONSE_LABELS[reponse]}
              variant={current?.reponse === reponse ? 'primary' : 'secondary'}
              teinte={couleurs[reponse]}
              icon={current?.reponse === reponse ? 'checkCircle' : undefined}
              loading={pending?.evenementId === ev.id && pending.reponse === reponse}
              onPress={() => (plusieursJours && reponse === 'present' ? setChoixOuvert(true) : envoyer({ reponse }))}
            />
          ))}
          {plusieursJours && current?.reponse === 'present' && <MesJours reponse={current} />}
          {confirmation.visible && <ReponseEnregistree />}
        </View>
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

function MesJours({ reponse }: { reponse: MaReponse }) {
  return (
    <Text variant="subhead" tone="secondary" style={styles.centre}>
      {resumerJoursChoisis(reponse.jours)}
      {reponse.precision ? ` · « ${reponse.precision} »` : ''}
    </Text>
  );
}

function ReponseEnregistree() {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={styles.saved}>
      <Icon name="checkCircle" size={20} color={colors.success} />
      <Text variant="subhead" style={{ color: colors.success, fontWeight: '600' }}>
        Réponse enregistrée, merci !
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  choices: { gap: 8 },
  centre: { textAlign: 'center' },
  saved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 4 },
});
