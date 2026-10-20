import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AuthScreen, authText } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

// Supabase limits password emails to one per minute for the same address.
const RESEND_DELAY_SECONDS = 60;

// Step 1: the member asks for a code by email. Step 2: they type it, which signs
// them in and opens the "new password" screen (PASSWORD_RECOVERY, see session.tsx).
// A code needs no deep link or redirect URL, and works the same in Expo Go.
export default function MotDePasseOublieScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    const address = email.trim();
    if (!address) {
      setError('Saisissez votre email.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address);
    setLoading(false);
    if (resetError) {
      setError(authErrorMessage(resetError));
      return;
    }
    setSentTo(address);
    setCode('');
    setWait(RESEND_DELAY_SECONDS);
  }

  async function checkCode() {
    const token = code.replace(/\s/g, '');
    if (!sentTo || !token) {
      setError('Saisissez le code reçu par email.');
      return;
    }
    setLoading(true);
    setError(null);
    // On success the member is signed in and the root layout shows the new password screen.
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'recovery' });
    setLoading(false);
    if (verifyError) setError(authErrorMessage(verifyError, 'code'));
  }

  if (sentTo) {
    return (
      <AuthScreen>
        <Text variant="title" style={authText.title}>
          Saisissez le code
        </Text>
        <Text style={authText.body}>
          Si un compte existe pour {sentTo}, vous avez reçu un email avec un code. Recopiez-le ici. Pensez à
          regarder dans les courriers indésirables.
        </Text>
        <TextField
          onDark
          label="Code reçu par email"
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={checkCode}
        />
        {error && (
          <Text style={authText.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <Button title="Valider" variant="light" onPress={checkCode} loading={loading} />
        <Button
          title={wait > 0 ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}
          variant="lightPlain"
          disabled={wait > 0}
          onPress={sendCode}
        />
        <Button title="Changer d’adresse email" variant="lightPlain" onPress={() => setSentTo(null)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Text style={authText.body}>Nous vous envoyons un code par email pour choisir un nouveau mot de passe.</Text>
      <TextField
          onDark
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
        onSubmitEditing={sendCode}
      />
      {error && <Text style={authText.error}>{error}</Text>}
      <Button title="Envoyer le code" variant="light" onPress={sendCode} loading={loading} />
    </AuthScreen>
  );
}
