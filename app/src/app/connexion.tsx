import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

// Neutral Allianceo screen: the association is only known once signed in.
export default function ConnexionScreen() {
  const { colors } = useTheme();
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
    <FormScreen style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20 }}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Icon name="people" size={36} color={colors.onPrimary} />
        </View>
        <Text variant="largeTitle">Allianceo</Text>
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
  brand: { alignItems: 'center', gap: 8, marginBottom: 16 },
  logo: { width: 76, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  signup: { marginTop: 'auto', paddingTop: 24, gap: 12 },
});
