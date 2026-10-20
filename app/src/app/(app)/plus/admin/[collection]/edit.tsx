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
  useAdminList,
  useCollection,
  useDeleteItem,
  useSaveItem,
  type Collection,
  type FormValues,
  type Row,
} from '@/lib/admin';
import { confirmAction, showMessage } from '@/lib/confirm';
import { pickPhoto, type PickedPhoto } from '@/lib/photos';

// Creates an item (no id) or edits one (id), for any admin collection.
export default function AdminEditScreen() {
  const { collection, id } = useLocalSearchParams<{ collection: string; id?: string }>();
  const c = useCollection(collection);
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

/**
 * The form of a collection item. `own` is for a member editing their own directory entry:
 * their photos go in their own folder, a new entry is theirs, and it cannot be deleted.
 */
export function EditForm({
  collection: c,
  row,
  own,
}: {
  collection: Collection;
  row?: Row;
  own?: { memberId: string; title: string; hideFields?: string[]; canDelete?: boolean; submitLabel?: string };
}) {
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

  async function choosePhoto() {
    setPicking(true);
    try {
      const picked = await pickPhoto({ outputWidth: c.photo?.width, crop: c.photo?.crop });
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
      {
        id: row?.id,
        values,
        photo,
        extra: own ? { user_id: own.memberId } : undefined,
        photoFolder: own?.memberId,
      },
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
          title: own ? own.title : row ? c.editTitle : c.newTitle,
          headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} />,
        }}
      />
      <FormScreen>
        {c.fields.filter((f) => !own?.hideFields?.includes(f.key)).map((field) =>
          field.type === 'photo' ? (
            <PhotoField
              key={field.key}
              label={field.label}
              uri={photo?.uri ?? (values[field.key] || null)}
              loading={picking}
              whole={c.photo?.crop === false}
              onPick={choosePhoto}
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
        <Button title={row ? 'Enregistrer' : (own?.submitLabel ?? c.addLabel)} onPress={submit} loading={save.isPending} />
        {row && (!own || own.canDelete) && <Button title="Supprimer" variant="destructive" onPress={destroy} loading={remove.isPending} />}
      </FormScreen>
    </>
  );
}
