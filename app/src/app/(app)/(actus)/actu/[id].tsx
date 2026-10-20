import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActuPhoto, DateTile, useCategoryHue } from '@/components/actu-visual';
import { CommentComposer, CommentCount, CommentsSection, LikeButton } from '@/components/social';
import { Icon } from '@/components/ui/icon';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useActu, useAuteurs } from '@/lib/data';
import { formatDayLong } from '@/lib/format';
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const auteurs = useAuteurs();
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
  const author = a.auteur_id ? auteurs.get(a.auteur_id) : undefined;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: heroColor, paddingTop: insets.top + 8 }]}>
          <Animated.View entering={FadeInDown.delay(150).duration(450)} style={styles.heroMeta}>
            <Text variant="footnote" style={styles.heroCategory} numberOfLines={1}>
              {a.categorie.toUpperCase()}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(230).duration(500)} style={styles.heroTitleRow}>
            {!!a.date_evenement && <DateTile date={a.date_evenement} large />}
            <Text variant="title" style={styles.heroTitle} selectable>
              {a.titre}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            {!!a.date_evenement && (
              <Text variant="subhead" style={styles.heroEventDate}>
                Événement le {formatDayLong(a.date_evenement).toLowerCase()}
              </Text>
            )}
            <Text variant="footnote" style={styles.heroDate}>
              Publié le {formatDayLong(a.date).toLowerCase()}
              {author ? ` par ${author}` : ''}
            </Text>
          </Animated.View>
        </View>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.article}>
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
          </View>
          {/* The comments sit on their own grey ground, apart from the post. */}
          <View style={[styles.comments, { backgroundColor: colors.background }]}>
            <CommentsSection kind="actu" parentId={a.id} hideComposer />
          </View>
        </View>
      </ScrollView>
      {/* Pinned at the bottom, above the keyboard, like in a messaging app. */}
      <View
        style={[
          styles.composer,
          { backgroundColor: colors.background, paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom - 6, 8) },
        ]}>
        <CommentComposer
          kind="actu"
          parentId={a.id}
          onInputFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
        />
      </View>
      {close}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  // Same row as the close button (36 high, 16 from the right).
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, marginRight: 52 },
  heroCategory: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', letterSpacing: 0.4 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroDate: { color: 'rgba(255,255,255,0.85)' },
  heroEventDate: { color: '#FFFFFF', fontWeight: '700', marginBottom: 2 },
  heroTitle: { color: '#FFFFFF', fontWeight: '800', flex: 1, fontSize: 26, lineHeight: 32 },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', flexGrow: 1 },
  article: { padding: 20, gap: 14 },
  comments: { flexGrow: 1, padding: 20, paddingBottom: 8 },
  composer: { paddingHorizontal: 20, paddingTop: 4 },
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
});
