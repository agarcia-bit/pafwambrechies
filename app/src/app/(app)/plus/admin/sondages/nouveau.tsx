import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import { MAX_OPTIONS, MIN_OPTIONS, useCreateSondage } from '@/lib/sondages';
import { POSTPONE_DAYS } from '@/lib/poll-reminders';
import { useTheme } from '@/theme';

export default function NouveauSondageScreen() {
  const { colors } = useTheme();
  const create = useCreateSondage();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [obligatoire, setObligatoire] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (index: number, value: string) =>
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));

  function submit() {
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3) {
      setError('Écrivez la question du sondage.');
      return;
    }
    if (filled.length < MIN_OPTIONS) {
      setError(`Proposez au moins ${MIN_OPTIONS} réponses.`);
      return;
    }
    setError(null);
    create.mutate(
      { question: question.trim(), options: filled, obligatoire },
      { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) }
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} /> }} />
      <FormScreen>
        <TextField
          label="Question *"
          value={question}
          onChangeText={setQuestion}
          placeholder="Ex : Quelle date pour l’assemblée générale ?"
          multiline
          maxLength={300}
        />
        <View style={styles.options}>
          <Text variant="footnote" tone="secondary" style={styles.label}>
            RÉPONSES POSSIBLES ({MIN_OPTIONS} à {MAX_OPTIONS})
          </Text>
          {options.map((option, index) => (
            <View key={index} style={styles.optionRow}>
              <View style={styles.flex}>
                <TextField
                  label={`Réponse ${index + 1}`}
                  value={option}
                  onChangeText={(value) => setOption(index, value)}
                  maxLength={120}
                />
              </View>
              {options.length > MIN_OPTIONS && (
                <Button
                  compact
                  variant="plain"
                  title="Retirer"
                  onPress={() => setOptions((current) => current.filter((_, i) => i !== index))}
                />
              )}
            </View>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button
              variant="secondary"
              icon="plus"
              title="Ajouter une réponse"
              onPress={() => setOptions((current) => [...current, ''])}
            />
          )}
        </View>
        <ListSection
          footer={
            obligatoire
              ? 'Les membres ne peuvent pas ignorer ce sondage : l’app reste bloquée par ce sondage tant qu’ils n’ont pas répondu.'
              : `Les membres peuvent le repousser une seule fois. Un rappel leur est envoyé ${POSTPONE_DAYS} jours plus tard, même si l’app reste fermée, et le sondage devient alors obligatoire.`
          }>
          <ListRow
            icon="lock"
            title="Réponse obligatoire"
            subtitle="Pour accéder à l’application"
            right={
              <Switch
                accessibilityLabel="Réponse obligatoire pour accéder à l’application"
                value={obligatoire}
                onValueChange={setObligatoire}
                trackColor={{ true: colors.primary }}
              />
            }
          />
        </ListSection>
        <Text variant="footnote" tone="secondary">
          Les membres sont prévenus par une notification. Le sondage s’affiche en plein écran à l’ouverture de l’app,
          avant tout le reste. Les réponses sont nominatives : vous voyez qui a répondu quoi. Vous devrez y répondre aussi,
          comme les membres.
        </Text>
        {error && <Text tone="danger">{error}</Text>}
        <Button title="Lancer le sondage" onPress={submit} loading={create.isPending} />
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  options: { gap: 12 },
  label: { marginLeft: 4, letterSpacing: 0.5 },
  optionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  flex: { flex: 1 },
});
