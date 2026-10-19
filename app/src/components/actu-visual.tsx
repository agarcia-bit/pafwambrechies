import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ACTU_HUES } from '@/lib/categories';
import { dayParts, formatDay } from '@/lib/format';
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
function DateTile({ date }: { date: string }) {
  const { day, month } = dayParts(date);
  return (
    <View style={styles.tile} accessible accessibilityLabel={formatDay(date)}>
      <Text style={styles.tileMonth}>{month.replace('.', '').toUpperCase()}</Text>
      <Text style={styles.tileDay}>{day}</Text>
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

/** The post's photo (nothing when it has none). */
export function ActuPhoto({
  uri,
  tall,
  radius = 0,
}: {
  uri: string;
  /** Larger format (first post of the feed, post screen). */
  tall?: boolean;
  radius?: number;
}) {
  const { colors } = useTheme();
  return (
    <Image
      source={{ uri }}
      style={[styles.photo, { aspectRatio: tall ? 3 / 2 : 16 / 9, borderRadius: radius, backgroundColor: colors.fill }]}
      contentFit="cover"
      transition={200}
      accessibilityIgnoresInvertColors
    />
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
  photo: { width: '100%' },
});
