import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { ChoiceField, PhotoField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { HeaderButton } from '@/components/header-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { showMessage } from '@/lib/confirm';
import { pickPhoto, type PickedPhoto } from '@/lib/photos';
import { envoyerUnRetour, LIBELLES_DES_RETOURS, TYPES_DE_RETOUR, type TypeDeRetour } from '@/lib/retours';
import { useMember } from '@/lib/session';

// N'importe quel membre signale un bug ou propose une amélioration de l'application. Le message
// part à l'équipe d'Allianceo (pas au bureau), avec une capture d'écran facultative.
export default function RetourScreen() {
  const { profile } = useMember();
  const [type, setType] = useState<TypeDeRetour>('bug');
  const [texte, setTexte] = useState('');
  const [capture, setCapture] = useState<PickedPhoto | null>(null);
  const [choixEnCours, setChoixEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisirLaCapture() {
    setChoixEnCours(true);
    try {
      const photo = await pickPhoto({ outputWidth: 1200, crop: false });
      if (photo) setCapture(photo);
    } catch {
      showMessage('Image illisible', 'Choisissez une autre capture.');
    }
    setChoixEnCours(false);
  }

  async function envoyer() {
    if (texte.trim().length < 3) return setErreur('Décrivez en quelques mots ce qui se passe ou ce que vous proposez.');
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      await envoyerUnRetour(profile.id, type, texte, capture);
      router.back();
      showMessage('Merci !', 'Votre message est bien parti à l’équipe d’Allianceo.');
    } catch {
      setErreur('Le message n’a pas pu partir. Vérifiez votre connexion et réessayez.');
    }
    setEnvoiEnCours(false);
  }

  const estUnBug = type === 'bug';
  return (
    <>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Annuler" onPress={() => router.back()} /> }} />
      <FormScreen>
        <Text tone="secondary">Votre message part à l’équipe qui fabrique l’application, pas au bureau de l’association.</Text>
        <ChoiceField
          label="C’est…"
          options={TYPES_DE_RETOUR}
          value={type}
          onChange={(option) => setType(option as TypeDeRetour)}
          format={(option) => LIBELLES_DES_RETOURS[option as TypeDeRetour]}
        />
        <TextField
          label={estUnBug ? 'Que se passe-t-il ?' : 'Que proposez-vous ?'}
          value={texte}
          onChangeText={setTexte}
          placeholder={estUnBug ? 'Sur quel écran, ce que vous avez fait, ce qui s’est passé…' : 'Ce qui vous simplifierait la vie…'}
          multiline
          maxLength={4000}
        />
        <PhotoField
          label="Capture d’écran (facultative)"
          uri={capture?.uri ?? null}
          loading={choixEnCours}
          whole
          onPick={choisirLaCapture}
          onRemove={() => setCapture(null)}
        />
        {erreur && <Text tone="danger">{erreur}</Text>}
        <Button title="Envoyer" onPress={envoyer} loading={envoiEnCours} />
      </FormScreen>
    </>
  );
}
