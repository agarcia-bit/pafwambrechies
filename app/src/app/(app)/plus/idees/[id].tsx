import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CommentCount, CommentsSection, LikeButton } from '@/components/social';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useIdee } from '@/lib/data';
import { formatRelative } from '@/lib/format';
import { useTheme } from '@/theme';

export default function IdeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idee = useIdee(Number(id));
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);

  if (idee.isPending) return <LoadingState />;
  if (idee.isError) return <ErrorState onRetry={idee.refetch} />;
  if (!idee.data) return <EmptyState title="Idée introuvable" message="Elle a peut-être été retirée." />;
  const i = idee.data;

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <View style={styles.meta}>
        <Badge label={i.categorie} />
        <Text variant="footnote" tone="secondary" style={styles.shrink}>
          {i.prenom || 'Anonyme'} · {formatRelative(i.created_at)}
        </Text>
      </View>
      {!!i.titre && (
        <Text variant="title" selectable>
          {i.titre}
        </Text>
      )}
      <Text selectable>{i.texte}</Text>
      <View style={styles.actions}>
        <LikeButton kind="idee" id={i.id} liked={i.my_like.length > 0} count={i.idees_likes[0]?.count ?? 0} />
        <CommentCount count={i.idees_commentaires[0]?.count ?? 0} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      <CommentsSection
        kind="idee"
        parentId={i.id}
        onInputFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shrink: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
