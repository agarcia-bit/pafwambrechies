import { router } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import {
  fileSize,
  MAX_DOCUMENT_BYTES,
  pickDocument,
  useAddDocument,
  type PickedDocument,
} from '@/lib/documents';

// Title of a document suggested from its file name ("statuts-2026.pdf" becomes "statuts 2026").
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

export default function NewDocumentScreen() {
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useAddDocument();
  const tooBig = !!file?.size && file.size > MAX_DOCUMENT_BYTES;

  async function choose() {
    setError(null);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      setFile(picked);
      if (!titre.trim()) setTitre(titleFrom(picked.name));
    } catch {
      setError('Ce fichier n’a pas pu être ouvert.');
    }
  }

  function submit() {
    if (!file) return;
    setError(null);
    add.mutate(
      { titre, categorie, file },
      {
        onSuccess: () => router.back(),
        onError: (e) =>
          setError(
            e instanceof Error && e.message === 'too_large'
              ? 'Ce fichier dépasse 20 Mo.'
              : adminErrorMessage(e)
          ),
      }
    );
  }

  return (
    <FormScreen>
      <Text tone="secondary">
        Les adhérents pourront ouvrir ce document depuis Plus → Documents. Formats acceptés : PDF, images, Word, Excel,
        PowerPoint, texte (20 Mo au plus).
      </Text>
      <Button
        title={file ? 'Choisir un autre fichier' : 'Choisir un fichier'}
        icon="document"
        variant="secondary"
        onPress={choose}
      />
      {file && (
        <Text variant="subhead" tone="secondary" numberOfLines={2}>
          {file.name}
          {file.size ? ` · ${fileSize(file.size)}` : ''}
        </Text>
      )}
      {tooBig && <Text tone="danger">Ce fichier dépasse 20 Mo.</Text>}
      <TextField label="Titre" value={titre} onChangeText={setTitre} placeholder="Statuts de l’association" maxLength={120} />
      <TextField
        label="Catégorie (facultatif)"
        value={categorie}
        onChangeText={setCategorie}
        placeholder="Statuts, Comptes rendus, Formulaires…"
        maxLength={60}
      />
      {error && <Text tone="danger">{error}</Text>}
      <Button
        title="Ajouter le document"
        onPress={submit}
        disabled={!file || tooBig || titre.trim().length < 2}
        loading={add.isPending}
      />
    </FormScreen>
  );
}
