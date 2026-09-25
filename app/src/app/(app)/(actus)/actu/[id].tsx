import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CommentCount, CommentsSection, LikeButton } from '@/components/social';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { ACTU_HUES } from '@/lib/categories';
import { useActu } from '@/lib/data';
import { formatDay } from '@/lib/format';
import { useTheme } from '@/theme';

export default function ActuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const actu = useActu(Number(id));
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);

  if (actu.isPending) return <LoadingState />;
  if (actu.isError) return <ErrorState onRetry={actu.refetch} />;
  if (!actu.data) return <EmptyState title="Actualité introuvable" message="Elle a peut-être été supprimée." />;
  const a = actu.data;

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <View style={styles.meta}>
        <Badge label={a.categorie} hue={ACTU_HUES[a.categorie]} />
        <Text variant="footnote" tone="secondary">
          {formatDay(a.date)}
        </Text>
      </View>
      <Text variant="title" selectable>
        {a.titre}
      </Text>
      {!!a.contenu && <Text selectable>{a.contenu}</Text>}
      <View style={styles.actions}>
        <LikeButton kind="actu" id={a.id} liked={a.my_like.length > 0} count={a.actus_likes[0]?.count ?? 0} />
        <CommentCount count={a.actus_commentaires[0]?.count ?? 0} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      <CommentsSection
        kind="actu"
        parentId={a.id}
        onInputFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
