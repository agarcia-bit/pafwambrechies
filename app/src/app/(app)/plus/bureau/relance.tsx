import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { estRecente, quandEstCe, texteDeLEssai } from '@/lib/creneaux';
import { showMessage } from '@/lib/confirm';
import { messageDeLaRelance, useApercuDeRelance, useDerniereRelance, useEnvoyerLaRelance, useEssayerLaRelance } from '@/lib/relance';
import { useTheme } from '@/theme';
import { tint } from '@/theme/colors';

/**
 * « Prévenir les membres » depuis le Pilotage : combien de personnes seront prévenues et comment,
 * le message tout prêt à retoucher, et un avertissement si une relance est déjà partie il y a
 * moins de 24 h ou si le planning est encore réservé au bureau.
 */
export default function RelanceScreen() {
  const { action, message: propose, ouvert } = useLocalSearchParams<{ action: string; message: string; ouvert: string }>();
  const actionId = Number(action);
  const [message, setMessage] = useState(propose ?? '');
  const apercu = useApercuDeRelance(actionId);
  const derniere = useDerniereRelance(actionId);
  const envoi = useEnvoyerLaRelance(actionId);
  const essai = useEssayerLaRelance(actionId);
  const total = apercu.data ? apercu.data.nb_notifications + apercu.data.nb_emails : null;

  function envoyer() {
    envoi.mutate(message, {
      onSuccess: ({ nb_notifications, nb_emails }) => {
        const n = nb_notifications + nb_emails;
        showMessage(`${n} personne${n > 1 ? 's' : ''} prévenue${n > 1 ? 's' : ''}`);
        router.back();
      },
    });
  }

  function essayer() {
    essai.mutate(message, { onSuccess: (parti) => showMessage(texteDeLEssai(parti)) });
  }

  return (
    <FormScreen>
      <Text accessibilityLiveRegion="polite">
        {apercu.isPending ? 'Calcul du nombre de personnes…'
          : apercu.isError ? messageDeLaRelance(apercu.error)
          : total === 0 ? 'Tout le monde est déjà inscrit : personne à prévenir.'
          : `${total} personne${total! > 1 ? 's' : ''} ${total! > 1 ? 'seront prévenues' : 'sera prévenue'} : ${apercu.data!.nb_notifications} par notification, ${apercu.data!.nb_emails} par e-mail.`}
      </Text>
      {estRecente(derniere.data ?? null) && derniere.data && (
        <Alerte texte={`Une relance est déjà partie ${quandEstCe(derniere.data.created_at)}. Évitez de prévenir les mêmes personnes trop souvent.`} />
      )}
      {ouvert !== '1' && <Alerte neutre texte="Le planning est réservé au bureau : il sera ouvert aux membres à l’envoi." />}
      <TextField label="Message" value={message} onChangeText={setMessage} multiline maxLength={1000} />
      <Text variant="footnote" tone="secondary">Par e-mail, on ajoute comment s’inscrire : ouvrir l’app Allianceo, onglet Agenda.</Text>
      {(envoi.isError || essai.isError) && <Text tone="danger" accessibilityLiveRegion="polite">{messageDeLaRelance(envoi.error ?? essai.error)}</Text>}
      <Button title="Envoyer" icon="send" loading={envoi.isPending} disabled={!message.trim() || !total} onPress={envoyer} />
      <Button title="M’envoyer un essai" variant="secondary" loading={essai.isPending} disabled={!message.trim() || envoi.isPending} onPress={essayer} />
    </FormScreen>
  );
}

function Alerte({ texte, neutre = false }: { texte: string; neutre?: boolean }) {
  const { colors, scheme } = useTheme();
  const { background, color } = neutre ? { background: colors.fill, color: colors.text } : tint(scheme, colors.warning);
  return (
    <View style={[styles.alerte, { backgroundColor: background }]}>
      <Text variant="subhead" style={{ color }}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alerte: { borderRadius: 12, padding: 12 },
});
