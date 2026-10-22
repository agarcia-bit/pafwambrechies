import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthScreen, authText } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { showMessage } from '@/lib/confirm';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// Shown after opening a password reset link (the member is then signed in).
export default function NouveauMotDePasseScreen() {
  const { endRecovery } = useSession();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }
    showMessage('Mot de passe modifié');
    endRecovery();
  }

  return (
    <AuthScreen fullScreen style={{ paddingTop: insets.top + 32 }}>
      <Text variant="title" style={authText.title}>
        Nouveau mot de passe
      </Text>
      <TextField
        onDark
        label="Nouveau mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="8 caractères minimum"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        onDark
        label="Confirmation"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {error && <Text style={authText.error}>{error}</Text>}
      <Button title="Enregistrer" onPress={save} loading={loading} />
      <Button title="Plus tard" variant="plain" onPress={endRecovery} />
    </AuthScreen>
  );
}
