import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { showMessage } from '@/lib/confirm';
import { fullName } from '@/lib/format';
import { ROLE_LABELS, useMembers, useSetMemberRole, type MemberRow } from '@/lib/members';
import { useMember } from '@/lib/session';
import type { Role } from '@/lib/types';
import { useTheme } from '@/theme';

const ROLES: Role[] = ['adherent', 'bureau', 'admin'];

// Who can do what: bureau members manage the content with the admins, only admins manage
// the members (this screen) and the association settings.
export default function MembersScreen() {
  const members = useMembers();
  const { profile } = useMember();
  const { refreshing, onRefresh } = usePullToRefresh(members.refetch);

  return (
    <FlatList
      data={members.data ?? []}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MemberItem member={item} isMe={item.id === profile.id} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <Text tone="secondary" style={styles.intro}>
          Le bureau gère les contenus (actus, offres, agenda, annuaire, sondages) comme les administrateurs. Seuls les
          administrateurs gèrent les membres et les réglages.
        </Text>
      }
      ListEmptyComponent={
        members.isPending ? (
          <LoadingState />
        ) : members.isError ? (
          <ErrorState onRetry={members.refetch} />
        ) : (
          <EmptyState icon="people" title="Aucun membre" />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

function MemberItem({ member: m, isMe }: { member: MemberRow; isMe: boolean }) {
  const { colors } = useTheme();
  const setRole = useSetMemberRole();
  const name = fullName(m.prenom, m.nom) || m.email || 'Membre';

  function choose() {
    if (isMe) {
      showMessage('Votre rôle', 'Vous ne pouvez pas changer votre propre rôle : demandez à un autre administrateur.');
      return;
    }
    Alert.alert(name, 'Choisir le rôle de ce membre', [
      ...ROLES.filter((r) => r !== m.role).map((role) => ({
        text: ROLE_LABELS[role],
        onPress: () =>
          setRole.mutate(
            { memberId: m.id, role },
            { onError: () => showMessage('Changement impossible', 'Le rôle n’a pas pu être modifié. Réessayez.') }
          ),
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }

  return (
    <PressableCard style={styles.row} accessibilityLabel={`${name}, ${ROLE_LABELS[m.role]}`} onPress={choose}>
      <Avatar name={name} size={44} />
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {name}
          {isMe ? ' (vous)' : ''}
        </Text>
        {!!m.email && (
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {m.email}
          </Text>
        )}
        <Badge label={ROLE_LABELS[m.role]} />
      </View>
      {!isMe && <Icon name="chevron" size={14} color={colors.textSecondary} />}
    </PressableCard>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  intro: { marginHorizontal: 20, marginBottom: 16 },
  row: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  text: { flex: 1, gap: 4 },
  gap: { height: 8 },
});
