import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { associationName } from '@/components/association';
import { CommentCount, LikeButton, ShareButton } from '@/components/social';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ACTU_HUES } from '@/lib/categories';
import { formatRelative } from '@/lib/format';
import { useMember } from '@/lib/session';
import { useTheme } from '@/theme';
import type { Actu, Idee } from '@/lib/types';

export function ActuCard({ actu }: { actu: Actu }) {
  const { branding } = useMember();
  const { colors } = useTheme();
  const name = associationName(branding);
  const preview = (actu.excerpt || actu.contenu || '').trim();
  return (
    <PressableCard
      style={styles.card}
      accessibilityLabel={actu.titre}
      onPress={() => router.push({ pathname: '/actu/[id]', params: { id: String(actu.id) } })}>
      <View style={styles.author}>
        <Avatar name={name} uri={branding?.tenant_logo_url} size={40} />
        <View style={styles.shrink}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="footnote" tone="secondary">
            {formatRelative(actu.created_at)}
          </Text>
        </View>
        <Badge label={actu.categorie} hue={ACTU_HUES[actu.categorie]} />
      </View>
      <Text variant="title" style={styles.postTitle}>
        {actu.titre}
      </Text>
      {!!preview && (
        <Text tone="secondary" numberOfLines={4}>
          {preview}
        </Text>
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
    </PressableCard>
  );
}

export function IdeeCard({ idee }: { idee: Idee }) {
  const { colors } = useTheme();
  return (
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
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 12, padding: 16 },
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
