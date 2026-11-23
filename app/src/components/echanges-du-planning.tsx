import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { confirmAction, showMessage } from '@/lib/confirm';
import { echangesDeLAction, texteDeLEchange, useEchange, useMesEchanges, type Echange } from '@/lib/echanges-creneaux';
import type { PlanningOuvert } from '@/lib/mes-creneaux';
import { messageDuPlanning } from '@/lib/planning';

/**
 * Sur l'écran du planning : les échanges qu'on propose (annulables) et ceux qu'on reçoit
 * (« Accepter l'échange »). Rien quand il n'y en a pas.
 */
export function EchangesDuPlanning({ planning }: { planning: PlanningOuvert }) {
  const echanges = echangesDeLAction(useMesEchanges().data ?? [], planning.id);
  const { annuler, accepter } = useEchange();
  if (!echanges.length) return null;

  async function accepterLEchange(e: Echange) {
    const ok = await confirmAction({ title: 'Accepter l’échange ?', message: texteDeLEchange(e, planning.duree_minutes), confirmLabel: 'Échanger' });
    if (!ok) return;
    accepter.mutate(e.id, {
      onSuccess: () => showMessage('Échange fait', `Votre nouveau créneau : ${e.offert.pole}. Votre billet est à jour.`),
      onError: (erreur) => showMessage('Échange impossible', messageDuPlanning(erreur)),
    });
  }

  return (
    <View style={styles.bloc}>
      <Text variant="headline">Échanges</Text>
      {echanges.map((e) => (
        <Card key={e.id} style={styles.carte}>
          <Text variant="subhead">{texteDeLEchange(e, planning.duree_minutes)}</Text>
          {e.sens === 'recu' ? (
            <Button title="Accepter l’échange" compact loading={accepter.isPending} onPress={() => accepterLEchange(e)} />
          ) : (
            <Pressable accessibilityRole="button" hitSlop={8} disabled={annuler.isPending} onPress={() => annuler.mutate(e.id)} style={styles.lien}>
              <Text variant="footnote" tone="secondary" style={styles.souligne}>Annuler ma proposition</Text>
            </Pressable>
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 8 },
  carte: { padding: 14, gap: 10 },
  lien: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  souligne: { textDecorationLine: 'underline' },
});
