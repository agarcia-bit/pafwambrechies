import { router } from 'expo-router';
import { createContext, use, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** With `fadeOnly`, the blocks of the screen fade in without rising (the agenda). */
const FadeOnlyContext = createContext(false);
/** With `centered`, the detail rows are centered too. */
const CenteredContext = createContext(false);

/** "Retour" button of the full-screen screens, top left (white on the hero, grey on a plain screen). */
export function BackButton({ onHero = true }: { onHero?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const color = onHero ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      hitSlop={10}
      onPress={() => router.back()}
      style={[styles.back, { top: insets.top + 8, backgroundColor: onHero ? 'rgba(255,255,255,0.22)' : colors.fill }]}>
      <Icon name="chevronLeft" size={16} color={color} />
      <Text variant="subhead" style={[styles.backText, { color }]}>
        Retour
      </Text>
    </Pressable>
  );
}

/** Loading, error and not-found states of a full-screen screen, with a way out. */
export function DetailStatus({ children }: { children: ReactNode }) {
  return (
    <View style={styles.flex}>
      {children}
      <BackButton onHero={false} />
    </View>
  );
}

/**
 * Full-screen detail (event, offer, member): a hero in the given color with the title (and
 * an optional visual beside it), then the content on a white sheet. The screen rises from the
 * bottom (see the stack options of its layout) and its blocks appear one after the other.
 */
export function FullScreenDetail({
  color,
  label,
  title,
  subtitle,
  leading,
  footer,
  fadeOnly = false,
  centered = false,
  children,
}: {
  color: string;
  label?: string;
  title: string;
  subtitle?: string;
  /** Visual beside the title: date tile, logo… */
  leading?: ReactNode;
  /** Pinned to the bottom of the sheet (main action). */
  footer?: ReactNode;
  /** The blocks fade in where they are instead of rising: calmer. */
  fadeOnly?: boolean;
  /** Label, `leading` visual (date tile) and title, centered one under the other. */
  centered?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 52 }]}>
          <Animated.View entering={fadeOnly ? FadeIn.duration(180) : FadeInDown.delay(150).duration(450)} style={[styles.heroMeta, centered && styles.centeredRow]}>
            {!!label && (
              <Text variant="footnote" style={styles.heroLabel} numberOfLines={1}>
                {label.toUpperCase()}
              </Text>
            )}
          </Animated.View>
          <Animated.View entering={fadeOnly ? FadeIn.delay(30).duration(200) : FadeInDown.delay(230).duration(500)} style={[styles.heroTitleRow, centered && styles.centeredColumn]}>
            {leading}
            <View style={centered ? styles.centeredText : styles.flex}>
              <Text variant="title" style={[styles.heroTitle, centered && styles.centeredTitle]} selectable>
                {title}
              </Text>
              {!!subtitle && (
                <Text variant="subhead" style={[styles.heroSubtitle, centered && styles.centeredTitle]}>
                  {subtitle}
                </Text>
              )}
            </View>
          </Animated.View>
        </View>
        <FadeOnlyContext value={fadeOnly}>
          <CenteredContext value={centered}>
            <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
              {/* Centered: the details sit in the middle of the free height, above the pinned action. */}
              {centered ? <View style={styles.sheetBody}>{children}</View> : children}
              {!!footer && <View style={styles.footer}>{footer}</View>}
            </View>
          </CenteredContext>
        </FadeOnlyContext>
      </ScrollView>
      <BackButton />
    </View>
  );
}

/** A block of the sheet that appears with a small delay (0 = first block). */
export function Rise({ order = 0, children }: { order?: number; children: ReactNode }) {
  const fadeOnly = use(FadeOnlyContext);
  return (
    <Animated.View entering={fadeOnly ? FadeIn.delay(60 + order * 30).duration(200) : FadeInDown.delay(320 + order * 60).duration(500)}>
      {children}
    </Animated.View>
  );
}

/** Grey rounded card holding rows of details. */
export function DetailCard({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const centered = use(CenteredContext);
  // Centered: the rows keep their left alignment (the icons line up), the block sits in the middle.
  return (
    <View style={[styles.details, { backgroundColor: colors.background }]}>
      {centered ? <View style={styles.detailsBlock}>{children}</View> : children}
    </View>
  );
}

export function DetailRow({
  icon,
  text,
  hint,
  onPress,
}: {
  icon: IconName;
  text: string;
  hint?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const centered = use(CenteredContext);
  const content = (
    <>
      <View style={[styles.detailIcon, { backgroundColor: colors.card }]}>
        <Icon name={icon} size={18} />
      </View>
      <View style={centered ? styles.detailTextCentered : styles.flex}>
        <Text variant="headline">{text}</Text>
        {!!hint && (
          <Text variant="footnote" tone="primary" style={styles.hint}>
            {hint} ›
          </Text>
        )}
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${text}, ${hint}` : text}
      onPress={onPress}
      style={styles.detail}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.detail}>{content}</View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', height: 24 },
  centeredRow: { justifyContent: 'center' },
  centeredColumn: { flexDirection: 'column', alignItems: 'center', gap: 18 },
  centeredText: { alignSelf: 'stretch' },
  centeredTitle: { textAlign: 'center' },
  detailTextCentered: { flexShrink: 1 },
  sheetBody: { flexGrow: 1, justifyContent: 'center', gap: 18 },
  detailsBlock: { alignSelf: 'center', maxWidth: '100%' },
  heroLabel: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', letterSpacing: 0.4 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 26, lineHeight: 32 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 18, flexGrow: 1 },
  footer: { marginTop: 'auto', paddingTop: 12 },
  details: { borderRadius: 16, padding: 6 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10 },
  detailIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hint: { fontWeight: '600' },
  back: {
    position: 'absolute',
    left: 16,
    height: 36,
    borderRadius: 18,
    paddingLeft: 10,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: { fontWeight: '600' },
});
