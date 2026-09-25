import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CommentCount, LikeButton } from '@/components/social';
import { Badge } from '@/components/ui/badge';
import { PressableCard } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ACTU_HUES } from '@/lib/categories';
import { formatDay, formatRelative } from '@/lib/format';
import type { Actu, Idee } from '@/lib/types';

export function ActuCard({ actu }: { actu: Actu }) {
  const preview = (actu.excerpt || actu.contenu || '').trim();
  return (
    <PressableCard
      style={styles.card}
      accessibilityLabel={actu.titre}
      onPress={() => router.push({ pathname: '/actu/[id]', params: { id: String(actu.id) } })}>
      <View style={styles.meta}>
        <Badge label={actu.categorie} hue={ACTU_HUES[actu.categorie]} />
        <Text variant="footnote" tone="secondary">
          {formatDay(actu.date)}
        </Text>
      </View>
      <Text variant="headline">{actu.titre}</Text>
      {!!preview && (
        <Text variant="subhead" tone="secondary" numberOfLines={3}>
          {preview}
        </Text>
      )}
      <View style={styles.footer}>
        <LikeButton
          kind="actu"
          id={actu.id}
          liked={actu.my_like.length > 0}
          count={actu.actus_likes[0]?.count ?? 0}
        />
        <CommentCount count={actu.actus_commentaires[0]?.count ?? 0} />
      </View>
    </PressableCard>
  );
}

export function IdeeCard({ idee }: { idee: Idee }) {
  return (
    <PressableCard
      style={styles.card}
      accessibilityLabel={idee.titre || idee.texte}
      onPress={() => router.push({ pathname: '/plus/idees/[id]', params: { id: String(idee.id) } })}>
      <View style={styles.meta}>
        <Badge label={idee.categorie} />
        <Text variant="footnote" tone="secondary" numberOfLines={1} style={styles.shrink}>
          {idee.prenom || 'Anonyme'} · {formatRelative(idee.created_at)}
        </Text>
      </View>
      {!!idee.titre && <Text variant="headline">{idee.titre}</Text>}
      <Text variant="subhead" tone="secondary" numberOfLines={3}>
        {idee.texte}
      </Text>
      <View style={styles.footer}>
        <LikeButton
          kind="idee"
          id={idee.id}
          liked={idee.my_like.length > 0}
          count={idee.idees_likes[0]?.count ?? 0}
        />
        <CommentCount count={idee.idees_commentaires[0]?.count ?? 0} />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shrink: { flexShrink: 1 },
  footer: { flexDirection: 'row', gap: 20, marginTop: 4 },
});
