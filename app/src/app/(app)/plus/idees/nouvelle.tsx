import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { IDEE_CATEGORIES } from '@/lib/categories';
import { showMessage } from '@/lib/confirm';
import { useCreateIdee } from '@/lib/data';

type Category = (typeof IDEE_CATEGORIES)[number];

export default function NouvelleIdeeScreen() {
  const create = useCreateIdee();
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState<Category>(IDEE_CATEGORIES[0]);
  const [texte, setTexte] = useState('');
  const [error, setError] = useState<string | null>(null);

  function publish() {
    if (!titre.trim() || !texte.trim()) {
      setError('Donnez un nom à votre idée et décrivez-la.');
      return;
    }
    setError(null);
    create.mutate(
      { titre: titre.trim(), categorie, texte: texte.trim() },
      {
        onSuccess: () => {
          router.back();
          showMessage('Merci !', 'Votre idée est publiée.');
        },
        onError: () => setError("L'idée n'a pas pu être publiée. Vérifiez votre connexion."),
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} /> }} />
      <FormScreen>
        <TextField
          label="Nom de l’idée"
          value={titre}
          onChangeText={setTitre}
          placeholder="Ex : Organiser un marché de Noël"
          maxLength={120}
        />
        <ListSection title="Thématique">
          {IDEE_CATEGORIES.map((c) => (
            <ListRow
              key={c}
              title={c}
              onPress={() => setCategorie(c)}
              selected={c === categorie}
              hideChevron
              right={c === categorie ? <Icon name="check" size={18} /> : undefined}
            />
          ))}
        </ListSection>
        <TextField label="Votre idée" value={texte} onChangeText={setTexte} placeholder="Décrivez votre idée…" multiline />
        {error && <Text tone="danger">{error}</Text>}
        <Button title="Publier l’idée" onPress={publish} loading={create.isPending} />
      </FormScreen>
    </>
  );
}
