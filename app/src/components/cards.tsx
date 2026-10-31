import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ActuPhoto, PostMeta, useCategoryHue } from '@/components/actu-visual';
import { Entrance } from '@/components/entrance';
import { CommentCount, LIKED_COLOR, LikeButton, ShareButton } from '@/components/social';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatDayShort, formatRelative } from '@/lib/format';
import { useReadActus } from '@/lib/read-actus';
import { useTheme } from '@/theme';
import type { Actu, Idee } from '@/lib/types';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync();
};
const open = (actu: Actu) => router.push({ pathname: '/actu/[id]', params: { id: String(actu.id) } });

/** A post of the feed: in full while unread, a single line once read (opened or marked as read). */
export function ActuCard({ actu, index = 99 }: { actu: Actu; index?: number }) {
  const { isRead, markRead, markUnread } = useReadActus();
  if (isRead(actu.id)) {
    return (
      <ReadActuCard
        actu={actu}
        onUnread={() => {
          tap();
          markUnread(actu.id);
        }}
      />
    );
  }
  return (
    <UnreadActuCard
      actu={actu}
      index={index}
      onRead={() => {
        tap();
        markRead(actu.id);
      }}
    />
  );
}

function ReadActuCard({ actu, onUnread }: { actu: Actu; onUnread: () => void }) {
  const { colors } = useTheme();
  const hue = useCategoryHue(actu.categorie);
  const likes = actu.actus_likes[0]?.count ?? 0;
  const comments = actu.actus_commentaires[0]?.count ?? 0;
  const liked = actu.my_like.length > 0;
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <PressableCard style={styles.readCard} accessibilityLabel={`${actu.titre}, lue`} onPress={() => open(actu)}>
        <View style={[styles.readDot, { backgroundColor: hue }]} />
        <View style={styles.shrink}>
          <Text variant="subhead" tone="secondary" numberOfLines={1} style={styles.readTitle}>
            {actu.titre}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {actu.categorie} · {formatDayShort(actu.date_evenement ?? actu.date)}
          </Text>
        </View>
        <View
          style={styles.readStats}
          accessible
          accessibilityLabel={`${likes} j’aime, ${comments} commentaire${comments > 1 ? 's' : ''}`}>
          <Icon name={liked ? 'heartFill' : 'heart'} size={13} color={liked ? LIKED_COLOR : colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={styles.readBadgeText}>
            {likes}
          </Text>
          <View style={styles.statGap} />
          <Icon name="comment" size={13} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={styles.readBadgeText}>
            {comments}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marquer comme non lue"
          hitSlop={12}
          onPress={onUnread}
          style={styles.readBadge}>
          <Icon name="check" size={13} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary" style={styles.readBadgeText}>
            Lue
          </Text>
        </Pressable>
      </PressableCard>
    </Animated.View>
  );
}

function UnreadActuCard({ actu, index, onRead }: { actu: Actu; index: number; onRead: () => void }) {
  const { colors } = useTheme();
  const preview = (actu.excerpt || actu.contenu || '').trim();
  const text = (
    <View style={styles.postText}>
      <Text variant="title" style={styles.postTitle} numberOfLines={3}>
        {actu.titre}
      </Text>
      {!!preview && (
        <Text tone="secondary" numberOfLines={3}>
          {preview}
        </Text>
      )}
    </View>
  );
  return (
    <Entrance index={index}>
      <PressableCard
        style={styles.postCard}
        accessibilityLabel={actu.titre}
        onPress={() => open(actu)}>
        <PostMeta category={actu.categorie} date={actu.date} eventDate={actu.date_evenement} />
        <View style={styles.postBody}>
          {text}
          {!!actu.image_url && <ActuPhoto uri={actu.image_url} radius={12} minRatio={1.78} />}
          <View style={[styles.footer, { borderTopColor: colors.separator }]}>
            <LikeButton
              kind="actu"
              id={actu.id}
              liked={actu.my_like.length > 0}
              count={actu.actus_likes[0]?.count ?? 0}
            />
            <CommentCount count={actu.actus_commentaires[0]?.count ?? 0} />
            <ShareButton message={preview ? `${actu.titre}\n\n${preview}` : actu.titre} />
            <View style={styles.spacer} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marquer comme lue"
              hitSlop={10}
              onPress={onRead}
              style={[styles.markRead, { backgroundColor: colors.primarySoft }]}>
              <Icon name="check" size={14} color={colors.primary} />
              <Text variant="subhead" tone="primary" style={styles.more}>
                Lu
              </Text>
            </Pressable>
          </View>
        </View>
      </PressableCard>
    </Entrance>
  );
}

export function IdeeCard({ idee, index = 99 }: { idee: Idee; index?: number }) {
  const { colors } = useTheme();
  return (
    <Entrance index={index}>
      <PressableCard
        style={styles.card}
        accessibilityLabel={idee.titre || idee.texte}
        onPress={() => router.push({ pathname: '/plus/idees/[id]', params: { id: String(idee.id) } })}>
        <View style={styles.author}>
          <Avatar name={idee.prenom} size={40} round />
          <View style={styles.shrink}>
            <Text variant="headline" numberOfLines={1}>
              {idee.prenom || 'Anonyme'}
            </Text>
            <Text variant="footnote" tone="secondary">
              {formatRelative(idee.created_at)}
            </Text>
          </View>
          <Badge label={idee.categorie} />
        </View>
        {!!idee.titre && (
          <Text variant="title" style={styles.postTitle}>
            {idee.titre}
          </Text>
        )}
        <Text tone="secondary" numberOfLines={4}>
          {idee.texte}
        </Text>
        <View style={[styles.footer, { borderTopColor: colors.separator }]}>
          <LikeButton
            kind="idee"
            id={idee.id}
            liked={idee.my_like.length > 0}
            count={idee.idees_likes[0]?.count ?? 0}
          />
          <CommentCount count={idee.idees_commentaires[0]?.count ?? 0} />
          <View style={styles.spacer} />
          <ShareButton message={idee.titre ? `${idee.titre}\n\n${idee.texte}` : idee.texte} />
        </View>
      </PressableCard>
    </Entrance>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12, padding: 16 },
  postCard: { marginHorizontal: 16, padding: 0 },
  postBody: { gap: 12, padding: 16 },
  postText: { flex: 1, gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shrink: { flex: 1 },
  postTitle: { fontSize: 20, lineHeight: 26 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  more: { fontWeight: '600' },
  markRead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  readCard: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  readDot: { width: 8, height: 8, borderRadius: 4 },
  readTitle: { fontWeight: '600' },
  readStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 6 },
  statGap: { width: 6 },
  readBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  readBadgeText: { fontWeight: '600' },
  spacer: { flex: 1 },
});
