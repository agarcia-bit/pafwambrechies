import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';
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
  const reduceMotion = useReducedMotion();
  // The arrival: the logo pops in, then the name, then the form rises line by line.
  const arrive = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
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
    <LinearGradient colors={['#14B8A6', '#0B5F58']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
    <StatusBar style="light" />
    <FormScreen
      fullScreen
      transparent
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, gap: 12 }}>
      <View style={styles.middle}>
      <View style={styles.brand}>
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(750).easing(Easing.out(Easing.back(1.6)))}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} accessibilityLabel="Logo Allianceo" />
        </Animated.View>
        <Animated.View entering={arrive(350)} style={styles.wordmark}>
          {/* Same width as the dot, so that the name itself stays centered. */}
          <View style={styles.wordmarkSpacer} />
          <Text variant="largeTitle" style={styles.wordmarkText}>
            ALLIANCEO
          </Text>
          <Animated.View
            entering={reduceMotion ? undefined : ZoomIn.delay(900).duration(450).easing(Easing.out(Easing.back(3)))}
            style={styles.wordmarkDot}
          />
        </Animated.View>
        <Animated.View entering={arrive(500)}>
          <Text style={[styles.center, styles.tagline]}>L’espace adhérents de votre association</Text>
        </Animated.View>
      </View>

      <Animated.View entering={arrive(700)}>
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
        returnKeyType="next"
      />
      </Animated.View>
      <Animated.View entering={arrive(790)}>
      <TextField
        onDark
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={signIn}
      />
      </Animated.View>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <Animated.View entering={arrive(880)}>
        <Button title="Se connecter" variant="light" onPress={signIn} loading={loading} />
      </Animated.View>
      <Animated.View entering={arrive(960)}>
        <Button
          title="Mot de passe oublié ?"
          variant="lightPlain"
          onPress={() => router.push({ pathname: '/mot-de-passe-oublie', params: { email: email.trim() } })}
        />
      </Animated.View>

      </View>

      <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(1100).duration(600)} style={styles.signup}>
        <Text style={[styles.center, styles.tagline]}>
          Première fois ? Votre association vous a communiqué un code d’accès.
        </Text>
        <Button title="Créer mon compte" variant="glass" onPress={() => router.push('/inscription')} />
      </Animated.View>
    </FormScreen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Logo, fields and buttons are centered in the free space; the sign-up block stays at the bottom.
  middle: { flex: 1, justifyContent: 'center', gap: 12 },
  brand: { alignItems: 'center', gap: 6, marginBottom: 12 },
  // The brand colors of the logo: its teal for the name, its amber for the dot.
  wordmark: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  wordmarkText: { color: '#FFFFFF', letterSpacing: 2 },
  tagline: { color: 'rgba(255,255,255,0.85)' },
  error: { color: '#FFE4E1', fontWeight: '600' },
  screen: { flex: 1 },
  wordmarkSpacer: { width: 10 },
  wordmarkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FBBF24', marginBottom: 8 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 19,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  center: { textAlign: 'center' },
  signup: { paddingTop: 12, gap: 10 },
});
