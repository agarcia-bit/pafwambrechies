import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionFields, openTache, TaskRow } from '@/components/bureau';
import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { adminErrorMessage } from '@/lib/admin';
import {
  tachesOf,
  useBureau,
  useDeleteAction,
  useSaveAction,
  type Action,
  type ActionInput,
  type BureauData,
} from '@/lib/bureau';
import { confirmAction } from '@/lib/confirm';

function editable(a: Action): ActionInput {
  return {
    emoji: a.emoji,
    titre: a.titre,
    date_action: a.date_action,
    referent: a.referent,
    statut: a.statut,
    budget: a.budget,
  };
}

export default function ActionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bureau = useBureau();
  const action = bureau.data?.actions.find((a) => a.id === Number(id));

  if (action && bureau.data) return <ActionEditor key={action.id} action={action} data={bureau.data} />;
  if (bureau.isPending) return <LoadingState />;
  if (bureau.isError) return <ErrorState onRetry={bureau.refetch} />;
  return <EmptyState title="Action introuvable" message="Elle a peut-être été supprimée." />;
}

function ActionEditor({ action, data }: { action: Action; data: BureauData }) {
  const save = useSaveAction();
  const remove = useDeleteAction();
  const [values, setValues] = useState<ActionInput>(() => editable(action));
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(editable(action));
  const taches = tachesOf(data.taches, action.id);

  function submit() {
    if (!values.titre.trim()) {
      setError('Donnez un titre à l’action.');
      return;
    }
    setError(null);
    const saved = { ...values, titre: values.titre.trim() };
    save.mutate(
      { id: action.id, values: saved },
      // Back to what was saved, so the button hides once the action is refetched.
      { onSuccess: () => setValues(saved), onError: (e) => setError(adminErrorMessage(e)) }
    );
  }

  async function destroy() {
    const ok = await confirmAction({
      title: 'Supprimer cette action ?',
      message: taches.length ? `Ses ${taches.length} tâches seront aussi supprimées.` : undefined,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) remove.mutate(action.id, { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) });
  }

  return (
    <FormScreen>
      <ActionFields values={values} members={data.members} onChange={setValues} />
      {values.referent !== action.referent && (
        <Text variant="footnote" tone="secondary">
          Les tâches sans responsable seront confiées au nouveau référent.
        </Text>
      )}
      {error && <Text tone="danger">{error}</Text>}
      {dirty && <Button title="Enregistrer" onPress={submit} loading={save.isPending} />}

      <View style={styles.tasks}>
        <Text variant="headline">Tâches</Text>
        {taches.length ? (
          taches.map((t) => <TaskRow key={t.id} tache={t} members={data.members} />)
        ) : (
          <Text tone="secondary">Aucune tâche pour l’instant.</Text>
        )}
        <Button title="Nouvelle tâche" icon="plus" variant="secondary" onPress={() => openTache(action.id)} />
      </View>

      <Button title="Supprimer l’action" variant="destructive" onPress={destroy} loading={remove.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  tasks: { gap: 12, marginVertical: 8 },
});
