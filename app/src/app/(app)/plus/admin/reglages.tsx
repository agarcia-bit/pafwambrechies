import { useState } from 'react';
import { Share, StyleSheet, Switch, View } from 'react-native';

import { associationName } from '@/components/association';
import { ColorField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ListRow, ListSection } from '@/components/ui/list';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage, generateSignupCode, useSaveSettings, useSettings, type Settings } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { pickPhoto, uploadPhoto } from '@/lib/photos';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

const HEX = /^#[0-9a-f]{6}$/i;

const SECTIONS = [
  { key: 'module_annuaire', title: 'Annuaire', icon: 'people' },
  { key: 'module_offres', title: 'Offres', icon: 'tag' },
  { key: 'module_agenda', title: 'Agenda', icon: 'calendar' },
  { key: 'module_idees', title: 'Boîte à idées', icon: 'lightbulb' },
  { key: 'module_liens', title: 'Liens utiles', icon: 'link' },
  { key: 'module_documents', title: 'Documents', icon: 'document' },
] as const;

export default function ReglagesScreen() {
  const settings = useSettings();
  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState onRetry={settings.refetch} />;
  return <SettingsForm saved={settings.data} />;
}

function SettingsForm({ saved }: { saved: Settings }) {
  const { branding, profile } = useMember();
  const { colors } = useTheme();
  const save = useSaveSettings();
  const [s, setS] = useState<Settings>(saved);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Logo picked from the phone's photos: cut square, sent to the actus photos space (public, bureau
  // and admins only), and its address goes in the field. Saved with the other settings.
  async function chooseLogo() {
    try {
      const picked = await pickPhoto({ outputWidth: 512, crop: 'logo' });
      if (!picked) return;
      setUploadingLogo(true);
      const url = await uploadPhoto(picked, 'actus-photos', `logos/${profile.tenant_id}`);
      setS((current) => ({ ...current, tenant_logo_url: url }));
    } catch {
      showMessage('Envoi impossible', 'Vérifiez votre connexion, puis réessayez.');
    } finally {
      setUploadingLogo(false);
    }
  }
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
          <Avatar name={s.tenant_name || associationName(branding)} uri={s.tenant_logo_url.trim() || null} size={56} />
          <View style={styles.flex}>
            <Text variant="subhead" style={styles.logoLabel}>
              Logo
            </Text>
            <Text variant="footnote" tone="secondary">
              Une image carrée, de préférence sur fond transparent.
            </Text>
          </View>
        </View>
        <View style={styles.logoActions}>
          <Button
            compact
            variant="secondary"
            icon="photo"
            title={s.tenant_logo_url.trim() ? 'Changer le logo' : 'Choisir une image'}
            loading={uploadingLogo}
            onPress={chooseLogo}
          />
          {!!s.tenant_logo_url.trim() && (
            <Button compact variant="plain" title="Retirer" onPress={() => setS((c) => ({ ...c, tenant_logo_url: '' }))} />
          )}
        </View>
      </Section>

      <Section
        title="Sections de l’app"
        footer="Masquez ce qui ne sert pas à votre association : un club de sport n’a pas forcément besoin d’offres de partenaires. Les actus et Mon compte sont toujours là.">
        <ListSection>
          {SECTIONS.map(({ key, title, icon }) => (
            <ListRow
              key={key}
              icon={icon}
              title={title}
              right={
                <Switch
                  accessibilityLabel={title}
                  value={s[key] !== 'off'}
                  onValueChange={(on) => set(key)(on ? 'on' : 'off')}
                  trackColor={{ true: colors.primary }}
                />
              }
            />
          ))}
        </ListSection>
      </Section>

      <Section
        title="Vocabulaire"
        footer="Les mots de votre association. Laissez vide pour garder le mot par défaut. Pour les catégories, séparez-les par des virgules ; sans catégorie, les filtres n’apparaissent pas.">
        <TextField
          label="Nom de l’annuaire"
          value={s.label_annuaire}
          onChangeText={set('label_annuaire')}
          placeholder="Annuaire (ex : Membres, Partenaires)"
        />
        <TextField
          label="Catégories de l’annuaire"
          value={s.annuaire_categories}
          onChangeText={set('annuaire_categories')}
          placeholder="Ex : Commerçant, Restauration, Services"
          autoCorrect={false}
        />
        <TextField
          label="Nom des offres"
          value={s.label_offres}
          onChangeText={set('label_offres')}
          placeholder="Offres (ex : Avantages, Bons plans)"
        />
        <TextField
          label="Catégories des offres"
          value={s.offres_categories}
          onChangeText={set('offres_categories')}
          placeholder="Ex : Particulier, Professionnel"
          autoCorrect={false}
        />
        <TextField
          label="Champ « nom » à l’inscription"
          value={s.label_nom}
          onChangeText={set('label_nom')}
          placeholder="Nom (ex : Nom de l’entreprise)"
        />
      </Section>

      <Section
        title="Cotisations"
        footer="Le bureau tient la liste de ceux qui ont renouvelé, lance les campagnes de renouvellement et règle le lien de paiement depuis Administration › Cotisations. Le règlement se fait sur le site de l’association (HelloAsso par exemple), pas dans l’app.">
        <ListSection>
          <ListRow
            icon="card"
            title="Suivre les cotisations"
            right={
              <Switch
                accessibilityLabel="Suivre les cotisations"
                value={s.module_cotisations === 'on'}
                onValueChange={(on) => set('module_cotisations')(on ? 'on' : 'off')}
                trackColor={{ true: colors.primary }}
              />
            }
          />
        </ListSection>
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoLabel: { fontWeight: '600' },
  logoActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
