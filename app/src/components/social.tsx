import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { confirmAction, showMessage } from '@/lib/confirm';
import { useCommentMutations, useComments, useToggleLike, type SocialKind } from '@/lib/data';
import { formatRelative } from '@/lib/format';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';

const LIKED_COLOR = '#FF2D55';

export function LikeButton({ kind, id, liked, count }: { kind: SocialKind; id: number; liked: boolean; count: number }) {
  const { colors } = useTheme();
  const toggle = useToggleLike(kind, id);
  // While the like is saved, show the state computed from the moment it was pressed.
  const pressed = toggle.isPending ? toggle.variables : undefined;
  const shownLiked = pressed ? !pressed.liked : liked;
  const shownCount = pressed ? pressed.count + (pressed.liked ? -1 : 1) : count;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`J’aime, ${shownCount}`}
      accessibilityState={{ selected: shownLiked }}
      disabled={toggle.isPending}
      hitSlop={10}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggle.mutate({ liked, count }, { onError: () => showMessage('Action impossible', 'Vérifiez votre connexion.') });
      }}
      style={styles.action}>
      <Icon name={shownLiked ? 'heartFill' : 'heart'} size={19} color={shownLiked ? LIKED_COLOR : colors.textSecondary} />
      <Text variant="subhead" tone="secondary">
        {shownCount}
      </Text>
    </Pressable>
  );
}

export function CommentCount({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.action} accessible accessibilityLabel={`${count} commentaires`}>
      <Icon name="comment" size={18} color={colors.textSecondary} />
      <Text variant="subhead" tone="secondary">
        {count}
      </Text>
    </View>
  );
}

export function CommentsSection({
  kind,
  parentId,
  onInputFocus,
}: {
  kind: SocialKind;
  parentId: number;
  onInputFocus?: () => void;
}) {
  const { profile, isAdmin } = useMember();
  const { colors } = useTheme();
  const comments = useComments(kind, parentId);
  const { add, remove } = useCommentMutations(kind, parentId);
  const [text, setText] = useState('');
  const canSend = !!text.trim() && !add.isPending;

  function send() {
    if (!canSend) return;
    add.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: () => showMessage('Commentaire non envoyé', 'Vérifiez votre connexion et réessayez.'),
    });
  }

  async function removeComment(id: number) {
    const ok = await confirmAction({ title: 'Supprimer ce commentaire ?', confirmLabel: 'Supprimer', destructive: true });
    if (ok) remove.mutate(id, { onError: () => showMessage('Suppression impossible', 'Réessayez plus tard.') });
  }

  return (
    <View style={styles.comments}>
      <Text variant="headline">Commentaires</Text>
      {comments.isPending ? (
        <ActivityIndicator color={colors.textSecondary} />
      ) : comments.data?.length ? (
        comments.data.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Avatar name={c.prenom} size={32} round />
            <View style={styles.commentBody}>
              <Text variant="footnote" style={styles.author}>
                {c.prenom || 'Anonyme'}
                <Text variant="footnote" tone="secondary">
                  {'  '}
                  {formatRelative(c.created_at)}
                </Text>
              </Text>
              <Text variant="callout" selectable>
                {c.texte}
              </Text>
            </View>
            {(c.user_id === profile.id || isAdmin) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer ce commentaire"
                hitSlop={10}
                onPress={() => removeComment(c.id)}>
                <Icon name="trash" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        ))
      ) : (
        <Text tone="secondary">Aucun commentaire pour l’instant.</Text>
      )}

      <View style={[styles.inputRow, { backgroundColor: colors.card }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={onInputFocus}
          placeholder="Ajouter un commentaire…"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          multiline
          maxLength={1000}
          accessibilityLabel="Ajouter un commentaire"
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Envoyer" disabled={!canSend} onPress={send} hitSlop={8}>
          {add.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Icon name="send" size={30} color={canSend ? colors.primary : colors.separator} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  comments: { gap: 14 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentBody: { flex: 1, gap: 2 },
  author: { fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 22,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
});
