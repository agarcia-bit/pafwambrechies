import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { associationName } from '@/components/association';
import { DateField } from '@/components/form-fields';
import { FormScreen } from '@/components/form-screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { adminErrorMessage } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { invitationMessage, useImportAdherents, useSignupCode } from '@/lib/invitations';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';
import { useTheme } from '@/theme';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Added = { email: string; prenom: string; alreadyMember: boolean };

/**
 * One new member, between two imports: added to the list like an imported one (their account is
 * linked to it when they sign up with the same e-mail), then invited at once by e-mail or by any
 * messaging app.
 */
export default function InviteOneScreen() {
  const { branding } = useMember();
  const { cotisations } = useTenantConfig();
  const add = useImportAdherents();
  const code = useSignupCode();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [valide, setValide] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const valid = EMAIL.test(email.trim());

  function submit() {
    setError(null);
    const row = { prenom: prenom.trim(), nom: nom.trim(), email: email.trim().toLowerCase(), valide_jusqu: valide };
    add.mutate([row], {
      onSuccess: (result) =>
        setAdded({ email: row.email, prenom: row.prenom, alreadyMember: result.deja_inscrits > 0 && result.invites === 0 }),
      onError: (e) => setError(adminErrorMessage(e)),
    });
  }

  if (added) return <Invite added={added} assoc={associationName(branding)} code={code.data ?? null} />;

  return (
    <FormScreen>
      <Text tone="secondary">
        Un nouvel adhérent ? Ajoutez-le ici : son compte sera relié à sa fiche quand il s’inscrira avec la même adresse
        e-mail. Vous pourrez lui envoyer l’invitation juste après.
      </Text>
      <TextField label="Prénom" value={prenom} onChangeText={setPrenom} autoCapitalize="words" textContentType="givenName" />
      <TextField label="Nom" value={nom} onChangeText={setNom} autoCapitalize="words" textContentType="familyName" />
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      {cotisations.enabled && (
        <DateField label="Cotisation payée jusqu’au (facultatif)" value={valide} optional onChange={setValide} />
      )}
      {!!email.trim() && !valid && <Text tone="danger">Cette adresse e-mail n’est pas valide.</Text>}
      {error && <Text tone="danger">{error}</Text>}
      <Button title="Ajouter l’adhérent" onPress={submit} disabled={!valid} loading={add.isPending} />
    </FormScreen>
  );
}

function Invite({ added, assoc, code }: { added: Added; assoc: string; code: string | null }) {
  const { colors } = useTheme();
  const message = invitationMessage(assoc, code);
  const who = added.prenom || added.email;

  function mail() {
    const url = `mailto:${encodeURIComponent(added.email)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
    Linking.openURL(url).catch(() => showMessage('Messagerie introuvable', 'Utilisez « Envoyer autrement ».'));
  }

  function share() {
    Share.share({ message: message.body }).catch(() => showMessage('Partage impossible'));
  }

  return (
    <FormScreen>
      <View style={styles.done}>
        <View style={[styles.check, { backgroundColor: colors.primarySoft }]}>
          <Icon name="checkCircle" size={34} color={colors.primary} />
        </View>
        <Text variant="title" style={styles.center}>
          {added.alreadyMember ? `${who} a déjà un compte` : `${who} est ajouté`}
        </Text>
        <Text tone="secondary" style={styles.center}>
          {added.alreadyMember
            ? 'Cette personne utilise déjà l’application : sa fiche a été mise à jour, inutile de l’inviter.'
            : 'Envoyez-lui maintenant l’invitation : elle contient le code d’accès et les étapes pour créer son compte.'}
        </Text>
      </View>
      {!added.alreadyMember && (
        <>
          <Button title="Envoyer l’invitation par e-mail" icon="mail" onPress={mail} />
          <Button title="Envoyer autrement (SMS, WhatsApp…)" icon="share" variant="secondary" onPress={share} />
        </>
      )}
      <Button title="Terminé" variant="plain" onPress={() => router.back()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: 10, marginVertical: 24 },
  check: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  center: { textAlign: 'center' },
});
