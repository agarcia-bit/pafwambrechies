import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

// Neutral Allianceo screen: the association is only known once signed in.
export default function ConnexionScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Saisissez votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    // On success the session guard in the root layout opens the app.
    if (signInError) setError(authErrorMessage(signInError));
  }

  return (
    <FormScreen
      fullScreen
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, gap: 12 }}>
      <View style={styles.middle}>
      <View style={styles.brand}>
        <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityLabel="Logo Allianceo" />
        <View style={styles.wordmark}>
          <Text variant="largeTitle" style={styles.wordmarkText}>
            ALLIANCEO
          </Text>
          <View style={styles.wordmarkDot} />
        </View>
        <Text tone="secondary" style={styles.center}>
          L’espace adhérents de votre association
        </Text>
      </View>

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
        returnKeyType="next"
      />
      <TextField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={signIn}
      />
      {error && (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Button title="Se connecter" onPress={signIn} loading={loading} />
      <Button
        title="Mot de passe oublié ?"
        variant="plain"
        onPress={() => router.push({ pathname: '/mot-de-passe-oublie', params: { email: email.trim() } })}
      />

      </View>

      <View style={styles.signup}>
        <Text tone="secondary" style={styles.center}>
          Première fois ? Votre association vous a communiqué un code d’accès.
        </Text>
        <Button title="Créer mon compte" variant="secondary" onPress={() => router.push('/inscription')} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  // Logo, fields and buttons are centered in the free space; the sign-up block stays at the bottom.
  middle: { flex: 1, justifyContent: 'center', gap: 12 },
  brand: { alignItems: 'center', gap: 6, marginBottom: 12 },
  // The brand colors of the logo: its teal for the name, its amber for the dot.
  wordmark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  wordmarkText: { color: '#0F766E', letterSpacing: 2 },
  wordmarkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FBBF24', marginBottom: 8 },
  logo: { width: 76, height: 76, borderRadius: 19, marginBottom: 6 },
  center: { textAlign: 'center' },
  signup: { paddingTop: 12, gap: 10 },
});
