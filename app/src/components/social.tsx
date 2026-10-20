import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { LinkedText } from '@/components/ui/linked-text';
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
  const scale = useSharedValue(1);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`J’aime, ${shownCount}`}
      accessibilityState={{ selected: shownLiked }}
      disabled={toggle.isPending}
      hitSlop={10}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // The heart pops when a like is added.
        if (!liked) scale.set(withSequence(withSpring(1.5, { damping: 5, stiffness: 400 }), withSpring(1)));
        toggle.mutate({ liked, count }, { onError: () => showMessage('Action impossible', 'Vérifiez votre connexion.') });
      }}
      style={styles.action}>
      <Animated.View style={heart}>
        <Icon name={shownLiked ? 'heartFill' : 'heart'} size={21} color={shownLiked ? LIKED_COLOR : colors.textSecondary} />
      </Animated.View>
      <Text variant="subhead" style={{ color: shownLiked ? LIKED_COLOR : colors.textSecondary, fontWeight: '600' }}>
        {shownCount}
      </Text>
    </Pressable>
  );
}

/** Opens the system share sheet with the post's text. */
export function ShareButton({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Partager"
      hitSlop={10}
      onPress={() => Share.share({ message }).catch(() => showMessage('Partage impossible'))}
      style={styles.action}>
      <Icon name="share" size={20} color={colors.textSecondary} />
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

/** The comment input: inline under the comments, or pinned at the bottom of a screen. */
export function CommentComposer({
  kind,
  parentId,
  onInputFocus,
}: {
  kind: SocialKind;
  parentId: number;
  onInputFocus?: () => void;
}) {
  const { colors } = useTheme();
  const { add } = useCommentMutations(kind, parentId);
  const [text, setText] = useState('');
  const canSend = !!text.trim() && !add.isPending;

  function send() {
    if (!canSend) return;
    add.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: () => showMessage('Commentaire non envoyé', 'Vérifiez votre connexion et réessayez.'),
    });
  }

  return (
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
        <View style={styles.sendSlot}>
          {add.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Icon name="send" size={30} color={canSend ? colors.primary : colors.separator} />
          )}
        </View>
      </Pressable>
    </View>
  );
}

export function CommentsSection({
  kind,
  parentId,
  onInputFocus,
  hideComposer = false,
}: {
  kind: SocialKind;
  parentId: number;
  onInputFocus?: () => void;
  /** The input is shown elsewhere (CommentComposer, pinned at the bottom of the screen). */
  hideComposer?: boolean;
}) {
  const { profile, isBureau } = useMember();
  const { colors } = useTheme();
  const comments = useComments(kind, parentId);
  const { remove } = useCommentMutations(kind, parentId);

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
          <View key={c.id} style={[styles.comment, { backgroundColor: colors.card }]}>
            <Avatar name={c.prenom} size={36} round />
            <View style={styles.commentBody}>
              <View style={styles.commentHead}>
                <Text variant="subhead" style={styles.author} numberOfLines={1}>
                  {c.prenom || 'Anonyme'}
                </Text>
                {(c.user_id === profile.id || isBureau) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer ce commentaire"
                    hitSlop={10}
                    onPress={() => removeComment(c.id)}>
                    <Icon name="trash" size={16} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              <Text variant="footnote" tone="secondary">
                {formatRelative(c.created_at)}
              </Text>
              <LinkedText variant="callout">{c.texte}</LinkedText>
            </View>
          </View>
        ))
      ) : (
        <Text tone="secondary">Aucun commentaire pour l’instant.</Text>
      )}

      {!hideComposer && <CommentComposer kind={kind} parentId={parentId} onInputFocus={onInputFocus} />}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  comments: { gap: 10 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 16, padding: 12 },
  commentBody: { flex: 1, gap: 2 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { fontWeight: '700', flex: 1 },
  sendSlot: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
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
