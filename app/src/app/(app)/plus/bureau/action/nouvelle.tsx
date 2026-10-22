import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { ActionFields } from '@/components/bureau';
import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { adminErrorMessage } from '@/lib/admin';
import { useBureau, useSaveAction, type ActionInput } from '@/lib/bureau';
import { todayISO } from '@/lib/format';

export default function NouvelleActionScreen() {
  const bureau = useBureau();
  const save = useSaveAction();
  const [values, setValues] = useState<ActionInput>({
    emoji: null,
    titre: '',
    date_action: todayISO(),
    referent: null,
    statut: 'À faire',
    budget: null,
  });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!values.titre.trim()) {
      setError('Donnez un titre à l’action.');
      return;
    }
    setError(null);
    save.mutate(
      { values: { ...values, titre: values.titre.trim() } },
      { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) }
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} /> }} />
      {bureau.isPending ? (
        <LoadingState />
      ) : bureau.isError ? (
        <ErrorState onRetry={bureau.refetch} />
      ) : (
        <FormScreen>
          <ActionFields values={values} members={bureau.data.members} onChange={setValues} />
          {error && <Text tone="danger">{error}</Text>}
          <Button title="Créer l’action" onPress={submit} loading={save.isPending} />
        </FormScreen>
      )}
    </>
  );
}
