import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActuThumb, CategoryBand, DateTile } from '@/components/actu-visual';
import { Entrance } from '@/components/entrance';
import { CommentCount, LikeButton, ShareButton } from '@/components/social';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { formatRelative } from '@/lib/format';
import { useTheme } from '@/theme';
import type { Actu, Idee } from '@/lib/types';

export function ActuCard({ actu, index = 99 }: { actu: Actu; index?: number }) {
  const { colors } = useTheme();
  const preview = (actu.excerpt || actu.contenu || '').trim();
  const text = (
    <View style={styles.postText}>
      <Text variant="title" style={styles.postTitle} numberOfLines={actu.image_url ? 3 : undefined}>
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
        onPress={() => router.push({ pathname: '/actu/[id]', params: { id: String(actu.id) } })}>
        <CategoryBand category={actu.categorie} />
        <View style={styles.postBody}>
          {actu.image_url ? (
            <View style={styles.withThumb}>
              <View>
                <ActuThumb uri={actu.image_url} />
                <View style={styles.thumbDate}>
                  <DateTile date={actu.date} />
                </View>
              </View>
              {text}
            </View>
          ) : (
            <View style={styles.withThumb}>
              <DateTile date={actu.date} onCard large />
              {text}
            </View>
          )}
          <View style={[styles.footer, { borderTopColor: colors.separator }]}>
            <LikeButton
              kind="actu"
              id={actu.id}
              liked={actu.my_like.length > 0}
              count={actu.actus_likes[0]?.count ?? 0}
            />
            <CommentCount count={actu.actus_commentaires[0]?.count ?? 0} />
            <View style={styles.spacer} />
            <ShareButton message={preview ? `${actu.titre}\n\n${preview}` : actu.titre} />
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
  // Posts bleed their picture to the card's edges, so the padding moves to the body.
  postCard: { marginHorizontal: 16, padding: 0 },
  postBody: { gap: 12, padding: 16 },
  // Photo thumbnail on the left, title and extract beside it.
  thumbDate: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  withThumb: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
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
  spacer: { flex: 1 },
});
