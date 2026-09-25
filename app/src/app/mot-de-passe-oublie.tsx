import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function MotDePasseOublieScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function sendLink() {
    const address = email.trim();
    if (!address) {
      setError('Saisissez votre email.');
      return;
    }
    setLoading(true);
    setError(null);
    // The link opens the app, which exchanges its code for a session (see useRecoveryLinks).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: Linking.createURL('/nouveau-mot-de-passe'),
    });
    setLoading(false);
    if (resetError) setError(authErrorMessage(resetError));
    else setSentTo(address);
  }

  if (sentTo) {
    return (
      <FormScreen>
        <Text variant="title">Vérifiez vos emails</Text>
        <Text>
          Si un compte existe pour {sentTo}, vous allez recevoir un lien pour choisir un nouveau mot de passe.
          Ouvrez-le sur ce téléphone.
        </Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Text tone="secondary">Nous vous envoyons un lien pour choisir un nouveau mot de passe.</Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="vous@exemple.fr"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={sendLink}
      />
      {error && <Text tone="danger">{error}</Text>}
      <Button title="Envoyer le lien" onPress={sendLink} loading={loading} />
    </FormScreen>
  );
}
