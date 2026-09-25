import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormScreen } from '@/components/form-screen';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { authErrorMessage } from '@/lib/auth-errors';
import { PRIVACY_POLICY_URL } from '@/lib/config';
import { openLink } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import type { Branding } from '@/lib/types';
import { BrandScope } from '@/theme';

// Step 1: the access code tells which association the member joins.
// Step 2: the member creates their account, shown in that association's colors.
export default function InscriptionScreen() {
  const [code, setCode] = useState('');
  const [association, setAssociation] = useState<Branding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkCode() {
    if (!code.trim()) {
      setError("Saisissez le code d'accès de votre association.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('resolve_signup_code', { p_code: code.trim() });
    setLoading(false);
    if (rpcError) setError('Pas de connexion internet. Réessayez.');
    else if (!data) setError("Code inconnu. Vérifiez-le auprès de votre association.");
    else setAssociation(data as Branding);
  }

  if (association) {
    return (
      <BrandScope color={association.tenant_primary_color}>
        <AccountForm code={code.trim()} association={association} onChangeCode={() => setAssociation(null)} />
      </BrandScope>
    );
  }

  return (
    <FormScreen>
      <Text variant="title">Code d’accès</Text>
      <Text tone="secondary">
        Chaque association communique un code à ses adhérents. Il vous permet de rejoindre son espace.
      </Text>
      <TextField
        label="Code d’accès"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="next"
        onSubmitEditing={checkCode}
      />
      {error && <Text tone="danger">{error}</Text>}
      <Button title="Continuer" onPress={checkCode} loading={loading} />
    </FormScreen>
  );
}

function AccountForm({
  code,
  association,
  onChangeCode,
}: {
  code: string;
  association: Branding;
  onChangeCode: () => void;
}) {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const name = association.tenant_name || association.name;

  async function signUp() {
    if (!prenom.trim() || !nom.trim() || !email.trim() || !password) {
      setError('Merci de remplir tous les champs.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    setError(null);
    // handle_new_user re-checks the code server-side and attaches the profile to its association.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { prenom: prenom.trim(), nom: nom.trim(), signup_code: code } },
    });
    setLoading(false);
    if (signUpError) setError(authErrorMessage(signUpError));
    // With a session the root layout opens the app; without one, the email must be confirmed first.
    else if (!data.session) setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <FormScreen>
        <Text variant="title">Vérifiez vos emails</Text>
        <Text>
          Votre compte est créé. Confirmez votre adresse avec le lien envoyé à {email.trim()}, puis connectez-vous.
        </Text>
        <Button title="Retour à la connexion" onPress={() => router.dismissTo('/connexion')} />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Card style={styles.association}>
        <Avatar name={name} uri={association.tenant_logo_url} size={56} />
        <View style={styles.associationText}>
          <Text variant="headline">{name}</Text>
          {association.tenant_tagline && <Text tone="secondary">{association.tenant_tagline}</Text>}
        </View>
      </Card>
      <Button title="Ce n’est pas mon association" variant="plain" onPress={onChangeCode} />

      <TextField label="Prénom" value={prenom} onChangeText={setPrenom} autoComplete="given-name" textContentType="givenName" />
      <TextField
        label="Nom de l’entreprise"
        value={nom}
        onChangeText={setNom}
        autoComplete="organization"
        textContentType="organizationName"
      />
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
      />
      <TextField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="8 caractères minimum"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={signUp}
      />
      {error && <Text tone="danger">{error}</Text>}
      <Button title="Créer mon compte" onPress={signUp} loading={loading} />
      <Text variant="footnote" tone="secondary" style={styles.center}>
        En créant un compte, vous acceptez la{' '}
        <Text variant="footnote" tone="primary" onPress={() => openLink(PRIVACY_POLICY_URL)}>
          politique de confidentialité
        </Text>
        .
      </Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  association: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  associationText: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
});
