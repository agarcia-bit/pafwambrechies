import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { associationName } from '@/components/association';
import { ColorField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage, generateSignupCode, useSaveSettings, useSettings, type Settings } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { useMember } from '@/lib/session';

const HEX = /^#[0-9a-f]{6}$/i;

export default function ReglagesScreen() {
  const settings = useSettings();
  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState onRetry={settings.refetch} />;
  return <SettingsForm saved={settings.data} />;
}

function SettingsForm({ saved }: { saved: Settings }) {
  const { branding } = useMember();
  const save = useSaveSettings();
  const [s, setS] = useState<Settings>(saved);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof Settings) => (value: string) => setS((current) => ({ ...current, [key]: value }));
  // Only a saved code works for signing up: never share one that is still being edited.
  const codeSaved = s.signup_code.trim() === saved.signup_code.trim();

  function submit() {
    if (s.signup_code.trim().length < 6) {
      setError('Le code d’accès doit contenir au moins 6 caractères.');
      return;
    }
    if ([s.tenant_primary_color, s.tenant_secondary_color].some((c) => c.trim() && !HEX.test(c.trim()))) {
      setError('Les couleurs s’écrivent avec un # et 6 caractères, par exemple #2E3192.');
      return;
    }
    setError(null);
    save.mutate(s, {
      onSuccess: () => showMessage('Réglages enregistrés'),
      onError: (e) =>
        setError(
          (e as { code?: string }).code === '23505'
            ? 'Ce code d’accès est déjà utilisé par une autre association. Choisissez-en un autre.'
            : adminErrorMessage(e)
        ),
    });
  }

  function shareCode() {
    const name = s.tenant_name.trim() || associationName(branding);
    Share.share({
      message: `Rejoignez l’espace adhérents de ${name} sur l’app Allianceo avec le code d’accès : ${saved.signup_code.trim()}`,
    }).catch(() => showMessage('Partage impossible', 'Copiez le code et envoyez-le à vos adhérents.'));
  }

  return (
    <FormScreen>
      <Section
        title="Code d’accès"
        footer="Les nouveaux adhérents en ont besoin pour créer leur compte. Changez-le pour bloquer les inscriptions avec l’ancien code. Un code généré ne peut pas être deviné.">
        <TextField
          label="Code actuel"
          value={s.signup_code}
          onChangeText={set('signup_code')}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
        <View style={styles.row}>
          <Button
            title="Générer"
            icon="refresh"
            variant="secondary"
            onPress={() => set('signup_code')(generateSignupCode())}
            style={styles.flex}
          />
          <Button
            title="Partager"
            icon="share"
            variant="secondary"
            disabled={!codeSaved || !saved.signup_code.trim()}
            onPress={shareCode}
            style={styles.flex}
          />
        </View>
        {!codeSaved && (
          <Text variant="footnote" tone="secondary">
            Enregistrez le nouveau code avant de le partager.
          </Text>
        )}
      </Section>

      <Section title="Identité" footer="Le nom, le logo et la couleur apparaissent dans l’app de tous les adhérents.">
        <TextField label="Nom de l’association" value={s.tenant_name} onChangeText={set('tenant_name')} />
        <TextField
          label="Sous-titre"
          value={s.tenant_tagline}
          onChangeText={set('tenant_tagline')}
          placeholder="Espace adhérents"
        />
        <ColorField
          label="Couleur principale (boutons, onglets)"
          value={s.tenant_primary_color}
          onChange={set('tenant_primary_color')}
        />
        <View style={styles.logoRow}>
          <Avatar name={s.tenant_name || associationName(branding)} uri={s.tenant_logo_url.trim() || null} size={48} />
          <View style={styles.flex}>
            <TextField
              label="Logo (adresse de l’image, carrée)"
              value={s.tenant_logo_url}
              onChangeText={set('tenant_logo_url')}
              placeholder="https://…/logo.png"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </Section>

      <Section title="Version web" footer="Utilisés seulement par l’app web de l’association.">
        <ColorField
          label="Couleur secondaire (en-tête)"
          value={s.tenant_secondary_color}
          onChange={set('tenant_secondary_color')}
        />
        <TextField
          label="Image de fond de la connexion"
          value={s.tenant_login_bg_url}
          onChangeText={set('tenant_login_bg_url')}
          placeholder="https://…/fond.jpg"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Section>

      {error && <Text tone="danger">{error}</Text>}
      <Button title="Enregistrer" onPress={submit} loading={save.isPending} />
    </FormScreen>
  );
}

function Section({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline">{title}</Text>
      {children}
      {footer && (
        <Text variant="footnote" tone="secondary">
          {footer}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1 },
});
