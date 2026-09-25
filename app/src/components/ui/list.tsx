import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** iOS-style inset grouped section: rows in a rounded card, separated by hairlines. */
export function ListSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      {title && (
        <Text variant="footnote" tone="secondary" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && (
        <Text variant="footnote" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      )}
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: ReactNode;
  hideChevron?: boolean;
  /** For choice lists: announced as selected by screen readers. */
  selected?: boolean;
  accessibilityHint?: string;
};

export function ListRow({
  title,
  subtitle,
  icon,
  value,
  onPress,
  destructive,
  right,
  hideChevron,
  selected,
  accessibilityHint,
}: ListRowProps) {
  const { colors } = useTheme();
  const tone = destructive ? colors.danger : colors.primary;
  const content = (
    <>
      {icon && (
        <View style={[styles.iconBox, { backgroundColor: destructive ? colors.fill : colors.primarySoft }]}>
          <Icon name={icon} size={17} color={tone} />
        </View>
      )}
      <View style={styles.texts}>
        <Text style={destructive && { color: colors.danger }}>{title}</Text>
        {subtitle && (
          <Text variant="footnote" tone="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {value && <Text tone="secondary">{value}</Text>}
      {right}
      {onPress && !right && !destructive && !hideChevron && (
        <Icon name="chevron" size={14} color={colors.textSecondary} />
      )}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  sectionTitle: { marginHorizontal: 16 },
  footer: { marginHorizontal: 16 },
  card: { borderRadius: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  iconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
});
