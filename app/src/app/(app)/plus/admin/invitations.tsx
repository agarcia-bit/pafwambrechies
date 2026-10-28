import { router } from 'expo-router';
import { Alert, Linking, RefreshControl, ScrollView, Share, StyleSheet } from 'react-native';

import { associationName } from '@/components/association';
import { Button } from '@/components/ui/button';
import { ListRow, ListSection } from '@/components/ui/list';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { showMessage } from '@/lib/confirm';
import { formatDay, fullName, plural } from '@/lib/format';
import {
  invitationMessage,
  useInvitations,
  useRemoveInvitation,
  useSignupCode,
  type Invite,
} from '@/lib/invitations';
import { useMember } from '@/lib/session';

// An e-mail with many recipients gets refused by some mail apps: they are sent in groups.
const MAIL_GROUP = 50;

const nameOf = (i: Invite) => fullName(i.prenom, i.nom) || i.email;

export default function InvitationsScreen() {
  const invites = useInvitations();
  const remove = useRemoveInvitation();
  const code = useSignupCode();
  const { branding } = useMember();
  const { refreshing, onRefresh } = usePullToRefresh(invites.refetch);

  if (invites.isPending) return <LoadingState />;
  if (invites.isError) return <ErrorState onRetry={invites.refetch} />;

  const waiting = invites.data.filter((i) => !i.user_id);
  const joined = invites.data.filter((i) => i.user_id);
  const message = invitationMessage(associationName(branding), code.data ?? null);

  function share() {
    Share.share({ message: message.body }).catch(() =>
      showMessage('Partage impossible', 'Copiez le message et envoyez-le à vos adhérents.')
    );
  }

  // The bureau's own mail app sends it, with the members in hidden copy: nobody sees the others' addresses.
  function sendMail(group: Invite[]) {
    const url =
      `mailto:?bcc=${group.map((i) => encodeURIComponent(i.email)).join(',')}` +
      `&subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
    Linking.openURL(url).catch(() =>
      showMessage('Messagerie introuvable', 'Utilisez « Partager l’invitation » pour envoyer le message autrement.')
    );
  }

  function mail() {
    if (waiting.length <= MAIL_GROUP) return sendMail(waiting);
    const groups = Array.from({ length: Math.ceil(waiting.length / MAIL_GROUP) }, (_, k) =>
      waiting.slice(k * MAIL_GROUP, (k + 1) * MAIL_GROUP)
    );
    Alert.alert('Envoyer par groupes', `${waiting.length} adhérents : le message est envoyé par groupes de ${MAIL_GROUP}.`, [
      ...groups.map((group, k) => ({
        text: `Groupe ${k + 1} sur ${groups.length} (${group.length})`,
        onPress: () => sendMail(group),
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }

  function manage(i: Invite) {
    Alert.alert(nameOf(i), i.email, [
      {
        text: 'Retirer de la liste',
        style: 'destructive',
        onPress: () =>
          remove.mutate(i.email, {
            onError: () => showMessage('Retrait impossible', 'La personne n’a pas pu être retirée. Réessayez.'),
          }),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text tone="secondary">
        Importez la liste de vos adhérents : ils reçoivent l’invitation à installer l’app, et leur compte est relié à leur
        fiche quand ils s’inscrivent avec la même adresse e-mail.
      </Text>
      <Button title="Importer une liste" icon="plus" onPress={() => router.push('/plus/admin/import')} />
      {waiting.length > 0 && (
        <>
          <Button title={`Inviter par e-mail (${waiting.length})`} icon="mail" variant="secondary" onPress={mail} />
          <Button title="Partager l’invitation" icon="share" variant="plain" onPress={share} />
        </>
      )}

      {!invites.data.length && (
        <Text tone="secondary" style={styles.empty}>
          Aucun adhérent importé pour l’instant.
        </Text>
      )}
      {waiting.length > 0 && (
        <ListSection title={`Pas encore inscrits (${waiting.length})`} footer="Touchez un adhérent pour le retirer de la liste.">
          {waiting.map((i) => (
            <ListRow
              key={i.email}
              title={nameOf(i)}
              subtitle={[i.prenom || i.nom ? i.email : '', i.valide_jusqu ? `Cotisation jusqu’au ${formatDay(i.valide_jusqu)}` : '']
                .filter(Boolean)
                .join(' · ')}
              onPress={() => manage(i)}
              hideChevron
            />
          ))}
        </ListSection>
      )}
      {joined.length > 0 && (
        <ListSection title={`Inscrits (${joined.length})`}>
          {joined.map((i) => (
            <ListRow
              key={i.email}
              icon="checkCircle"
              title={nameOf(i)}
              subtitle={i.joined_at ? `Inscrit le ${formatDay(i.joined_at.slice(0, 10))}` : undefined}
            />
          ))}
        </ListSection>
      )}
      {waiting.length > 0 && (
        <Text variant="footnote" tone="secondary">
          {plural(waiting.length, 'adhérent attend', 'adhérents attendent')} de créer leur compte. Relancez-les avec le même
          message quand vous voulez.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', marginVertical: 24 },
});
