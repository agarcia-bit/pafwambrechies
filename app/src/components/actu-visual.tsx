import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ACTU_HUES } from '@/lib/categories';
import { dayParts, formatDay } from '@/lib/format';
import { photoRatio } from '@/lib/photos';
import { useTheme } from '@/theme';
import { mix } from '@/theme/colors';

const CATEGORY_ICONS: Record<string, IconName> = {
  'Actu Asso': 'newspaper',
  'Infos pratiques': 'info',
  'Événement': 'calendar',
  Membres: 'people',
  Partenaire: 'tag',
};

/** Color of a post's category; "Actu Asso" takes the association's own color. */
export function useCategoryHue(category: string): string {
  const { colors } = useTheme();
  return category === 'Actu Asso' ? colors.primary : (ACTU_HUES[category] ?? colors.primary);
}

/** Date as the iPhone Calendar icon: month in red on top, day number below. */
export function DateTile({ date, onCard }: { date: string; /** On a white card instead of a colored band. */ onCard?: boolean }) {
  const { colors } = useTheme();
  const { day, month } = dayParts(date);
  return (
    <View
      style={[styles.tile, onCard && { backgroundColor: colors.fill }]}
      accessible
      accessibilityLabel={formatDay(date)}>
      <Text style={styles.tileMonth}>{month.replace('.', '').toUpperCase()}</Text>
      <Text style={[styles.tileDay, onCard && { color: colors.text }]}>{day}</Text>
    </View>
  );
}

/** Slim colored band on top of a post: its category with an icon, and its date as a calendar tile. */
export function CategoryBand({ category, date }: { category: string; date?: string }) {
  const hue = useCategoryHue(category);
  return (
    <View style={[styles.band, { backgroundColor: mix(hue, '#000000', 0.15) }]}>
      <Icon name={CATEGORY_ICONS[category] ?? 'newspaper'} size={20} color="rgba(255,255,255,0.95)" />
      <Text variant="subhead" style={[styles.bandLabel, styles.bandGrow]} numberOfLines={1}>
        {category}
      </Text>
      {!!date && <DateTile date={date} />}
    </View>
  );
}

// Formats shown as they are on the post screen: from 3:4 (portrait) to 1.91:1; beyond, a little is cut.
const MIN_RATIO = 0.75;
const MAX_RATIO = 1.91;

/**
 * The post's photo on the post screen, entire and never cut (the format is in the file name,
 * or read on load), at most 3:4 tall: a narrower photo is shown whole, centered, on a blurred
 * copy of itself.
 */
export function ActuPhoto({ uri, radius = 0 }: { uri: string; radius?: number }) {
  const { colors } = useTheme();
  const known = photoRatio(uri);
  const [loaded, setLoaded] = useState<number | null>(null);
  const natural = known ?? loaded ?? 4 / 3;
  const frame = Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural));
  const letterboxed = natural < frame - 0.01;
  const onLoad = (event: ImageLoadEventData) => {
    if (known == null && event.source.height > 0) setLoaded(event.source.width / event.source.height);
  };

  return (
    <View style={[styles.photo, { aspectRatio: frame, borderRadius: radius, backgroundColor: colors.fill }]}>
      {letterboxed && (
        <Image
          source={{ uri }}
          blurRadius={40}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      )}
      <Image
        source={{ uri }}
        onLoad={onLoad}
        contentFit={letterboxed ? 'contain' : 'cover'}
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Photo de l’actu"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * Square thumbnail of a post's photo, next to its text in the feed. The whole photo is
 * always visible: unless it is square, it sits centered on a blurred copy of itself.
 */
export function ActuThumb({ uri, size = 104, radius = 14 }: { uri: string; size?: number; radius?: number }) {
  const { colors } = useTheme();
  const known = photoRatio(uri);
  const [loaded, setLoaded] = useState<number | null>(null);
  const natural = known ?? loaded ?? 1;
  const letterboxed = Math.abs(natural - 1) > 0.02;
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radius, backgroundColor: colors.fill }]}>
      {letterboxed && (
        <Image
          source={{ uri }}
          blurRadius={30}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      )}
      <Image
        source={{ uri }}
        onLoad={(event) => {
          if (known == null && event.source.height > 0) setLoaded(event.source.width / event.source.height);
        }}
        contentFit={letterboxed ? 'contain' : 'cover'}
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Photo de l’actu"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  bandLabel: { color: '#FFFFFF', fontWeight: '600' },
  bandGrow: { flex: 1 },
  tile: {
    width: 36,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  tileMonth: { fontSize: 9, lineHeight: 11, fontWeight: '800', color: '#FF3B30', letterSpacing: 0.3 },
  tileDay: { fontSize: 18, lineHeight: 21, fontWeight: '600', color: '#000000' },
  photo: { width: '100%', overflow: 'hidden' },
  thumb: { overflow: 'hidden' },
});
