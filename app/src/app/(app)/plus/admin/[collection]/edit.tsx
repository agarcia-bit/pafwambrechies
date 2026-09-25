import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FieldView, PhotoField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import {
  adminErrorMessage,
  findCollection,
  useAdminList,
  useDeleteItem,
  useSaveItem,
  type Collection,
  type FormValues,
  type Row,
} from '@/lib/admin';
import { confirmAction, showMessage } from '@/lib/confirm';
import { pickDirectoryPhoto, type PickedPhoto } from '@/lib/photos';

// Creates an item (no id) or edits one (id), for any admin collection.
export default function AdminEditScreen() {
  const { collection, id } = useLocalSearchParams<{ collection: string; id?: string }>();
  const c = findCollection(collection);
  if (!c) return <EmptyState title="Section inconnue" />;
  if (!id) return <EditForm collection={c} />;
  return <ExistingItem collection={c} id={Number(id)} />;
}

function ExistingItem({ collection: c, id }: { collection: Collection; id: number }) {
  const list = useAdminList(c);
  const row = list.data?.find((r) => r.id === id);
  if (row) return <EditForm key={id} collection={c} row={row} />;
  if (list.isPending) return <LoadingState />;
  if (list.isError) return <ErrorState onRetry={list.refetch} />;
  return <EmptyState title="Élément introuvable" message="Il a peut-être été supprimé." />;
}

function EditForm({ collection: c, row }: { collection: Collection; row?: Row }) {
  const save = useSaveItem(c);
  const remove = useDeleteItem(c);
  const [values, setValues] = useState<FormValues>(() => (row ? c.toValues(row) : c.defaults()));
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      return c.derive ? c.derive(key, next) : next;
    });
  }

  async function pickPhoto() {
    setPicking(true);
    try {
      const picked = await pickDirectoryPhoto();
      if (picked) setPhoto(picked);
    } catch {
      showMessage('Photo illisible', 'Choisissez une autre photo.');
    }
    setPicking(false);
  }

  function submit() {
    const missing = c.fields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) {
      setError(`Le champ « ${missing.label} » est obligatoire.`);
      return;
    }
    setError(null);
    save.mutate(
      { id: row?.id, values, photo },
      { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) }
    );
  }

  async function destroy() {
    if (!row) return;
    const ok = await confirmAction({
      title: 'Supprimer définitivement ?',
      message: c.describe(row).title,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (ok) remove.mutate(row.id, { onSuccess: () => router.back(), onError: (e) => setError(adminErrorMessage(e)) });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: row ? c.editTitle : c.newTitle,
          headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} />,
        }}
      />
      <FormScreen>
        {c.fields.map((field) =>
          field.type === 'photo' ? (
            <PhotoField
              key={field.key}
              label={field.label}
              uri={photo?.uri ?? (values[field.key] || null)}
              loading={picking}
              onPick={pickPhoto}
              onRemove={() => {
                setPhoto(null);
                update(field.key, '');
              }}
            />
          ) : (
            <FieldView
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              onChange={(value) => update(field.key, value)}
            />
          )
        )}
        {!row && c.createHint && (
          <Text variant="footnote" tone="secondary">
            {c.createHint}
          </Text>
        )}
        {error && <Text tone="danger">{error}</Text>}
        <Button title={row ? 'Enregistrer' : c.addLabel} onPress={submit} loading={save.isPending} />
        {row && <Button title="Supprimer" variant="destructive" onPress={destroy} loading={remove.isPending} />}
      </FormScreen>
    </>
  );
}
