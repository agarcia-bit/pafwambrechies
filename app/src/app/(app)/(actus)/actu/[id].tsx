import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActuPhoto, useCategoryHue } from '@/components/actu-visual';
import { CommentCount, CommentsSection, LikeButton } from '@/components/social';
import { Icon } from '@/components/ui/icon';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useActu } from '@/lib/data';
import { formatDay } from '@/lib/format';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';

// The post fills the screen: a hero in the category's color (title in white), then the
// content on a white sheet whose rounded top overlaps the hero.
export default function ActuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const actu = useActu(Number(id));
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const hue = useCategoryHue(actu.data?.categorie ?? '');
  const heroColor = mix(hue, '#000000', 0.15);

  const close = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer"
      hitSlop={10}
      onPress={() => router.back()}
      style={[styles.close, { top: insets.top + 8 }]}>
      <Icon name="close" size={18} color="#FFFFFF" />
    </Pressable>
  );

  if (actu.isPending || actu.isError || !actu.data) {
    return (
      <View style={styles.flex}>
        {actu.isPending ? (
          <LoadingState />
        ) : actu.isError ? (
          <ErrorState onRetry={actu.refetch} />
        ) : (
          <EmptyState title="Actualité introuvable" message="Elle a peut-être été supprimée." />
        )}
        <View style={[styles.closeOnLight, { top: insets.top + 8, backgroundColor: colors.fill }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={() => router.back()}>
            <Icon name="close" size={18} />
          </Pressable>
        </View>
      </View>
    );
  }
  const a = actu.data;

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: heroColor, paddingTop: insets.top + 8 }]}>
          <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.heroMeta}>
            <Text variant="footnote" style={styles.heroCategory}>
              {a.categorie.toUpperCase()}
            </Text>
            <Text variant="footnote" style={styles.heroDate}>
              · {formatDay(a.date)}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(230).duration(500)}>
            <Text variant="largeTitle" style={styles.heroTitle} selectable>
              {a.titre}
            </Text>
          </Animated.View>
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {!!a.image_url && (
            <Animated.View entering={FadeInDown.delay(320).duration(500)}>
              <ActuPhoto uri={a.image_url} radius={16} />
            </Animated.View>
          )}
          {!!a.contenu && (
            <Animated.View entering={FadeInDown.delay(380).duration(500)}>
              <LinkedText>{a.contenu}</LinkedText>
            </Animated.View>
          )}
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
        </View>
      </ScrollView>
      {close}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  hero: { paddingHorizontal: 20, paddingBottom: 44, gap: 10 },
  // Same row as the close button (36 high, 16 from the right).
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, marginRight: 52 },
  heroCategory: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', letterSpacing: 0.4 },
  heroDate: { color: 'rgba(255,255,255,0.8)' },
  heroTitle: { color: '#FFFFFF', fontWeight: '800' },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 },
  close: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeOnLight: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
