import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { MemberField } from '@/components/bureau';
import { ChoiceField, FieldView } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import {
  PRIORITES,
  TACHE_STATUTS,
  useBureau,
  useDeleteTache,
  useSaveTache,
  type Action,
  type BureauMember,
  type Priorite,
  type Tache,
  type TacheInput,
  type TacheStatut,
} from '@/lib/bureau';
import { confirmAction } from '@/lib/confirm';

// New task of an action (actionId) or an existing one (actionId + id).
export default function TacheScreen() {
  const { actionId, id } = useLocalSearchParams<{ actionId: string; id?: string }>();
  const bureau = useBureau();
  const action = bureau.data?.actions.find((a) => a.id === Number(actionId));
  const tache = id ? bureau.data?.taches.find((t) => t.id === Number(id)) : undefined;

  let content;
  if (action && bureau.data && (!id || tache)) {
    content = <TacheEditor key={id ?? 'new'} action={action} tache={tache} members={bureau.data.members} />;
  } else if (bureau.isPending) {
    content = <LoadingState />;
  } else if (bureau.isError) {
    content = <ErrorState onRetry={bureau.refetch} />;
  } else {
    content = <EmptyState title="Tâche introuvable" message="Elle a peut-être été supprimée." />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? 'Modifier la tâche' : 'Nouvelle tâche',
          headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} />,
        }}
      />
      {content}
    </>
  );
}

function TacheEditor({ action, tache, members }: { action: Action; tache?: Tache; members: BureauMember[] }) {
  const save = useSaveTache();
  const remove = useDeleteTache();
  // Brief: a new task goes to the action's referent by default.
  const [values, setValues] = useState<TacheInput>(() =>
    tache
      ? {
          action_id: tache.action_id,
          libelle: tache.libelle,
          responsable: tache.responsable,
          echeance: tache.echeance,
          statut: tache.statut,
          priorite: tache.priorite,
        }
      : {
          action_id: action.id,
          libelle: '',
          responsable: action.referent,
          echeance: null,
          statut: 'À faire',
          priorite: 'Moyenne',
        }
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TacheInput>(key: K, value: TacheInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  function submit() {
    if (!values.libelle.trim()) {
      setError('Décrivez la tâche.');
      return;
    }
    setError(null);
    save.mutate(
      { id: tache?.id, values: { ...values, libelle: values.libelle.trim() } },
      { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) }
    );
  }

  async function destroy() {
    if (!tache) return;
    const ok = await confirmAction({ title: 'Supprimer cette tâche ?', confirmLabel: 'Supprimer', destructive: true });
    if (ok) remove.mutate(tache.id, { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) });
  }

  return (
    <FormScreen>
      <Text tone="secondary">
        {action.emoji ? `${action.emoji} ` : ''}
        {action.titre}
      </Text>
      <TextField label="Tâche *" value={values.libelle} onChangeText={(v) => set('libelle', v)} multiline />
      <MemberField label="Responsable" members={members} value={values.responsable} onChange={(id) => set('responsable', id)} />
      <FieldView
        field={{ key: 'echeance', label: 'Échéance', type: 'date' }}
        value={values.echeance ?? ''}
        onChange={(v) => set('echeance', v || null)}
      />
      <ChoiceField
        label="Priorité"
        options={PRIORITES}
        value={values.priorite}
        onChange={(v) => set('priorite', v as Priorite)}
      />
      <ChoiceField
        label="Statut"
        options={TACHE_STATUTS}
        value={values.statut}
        onChange={(v) => set('statut', v as TacheStatut)}
      />
      {error && <Text tone="danger">{error}</Text>}
      <Button title={tache ? 'Enregistrer' : 'Ajouter la tâche'} onPress={submit} loading={save.isPending} />
      {tache && <Button title="Supprimer la tâche" variant="destructive" onPress={destroy} loading={remove.isPending} />}
    </FormScreen>
  );
}
