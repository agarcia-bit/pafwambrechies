import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { DateTile } from '@/components/actu-visual';
import { Avatar } from '@/components/ui/avatar';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

// Small mock-ups of the real screens for the guided tour (components/guided-tour.tsx): the same
// cards, colors and wording as in the app, so the member recognizes them afterwards. Each one plays
// its entrance when its screen of the tour becomes the current one (`active`).

const SETTLE = Easing.out(Easing.cubic);
const LIKED = '#FF2D55';

/** Card of a mock-up, entering after `delay` ms. */
function MockCard({ delay = 0, active, children, style }: { delay?: number; active: boolean; children: ReactNode; style?: object }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      key={active ? 'on' : 'off'}
      entering={active && !reduceMotion ? FadeInUp.delay(delay).duration(420).easing(SETTLE) : undefined}
      style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </Animated.View>
  );
}

/** Soft pulsing ring that points at the element to remember. */
function Pulse({ active, children, radius = 999 }: { active: boolean; children: ReactNode; radius?: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], opacity: 2 - scale.get() * 1.4 + 0.4 }));
  useEffect(() => {
    if (!active || reduceMotion) return;
    scale.set(1);
    scale.set(withDelay(700, withRepeat(withSequence(withTiming(1.25, { duration: 900 }), withTiming(1, { duration: 0 })), -1)));
  }, [active, reduceMotion, scale]);
  return (
    <View>
      {!reduceMotion && <Animated.View pointerEvents="none" style={[styles.pulse, { borderRadius: radius }, ring]} />}
      {children}
    </View>
  );
}

function Pill({ label, icon, color, background }: { label: string; icon?: IconName; color: string; background: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon && <Icon name={icon} size={13} color={color} />}
      <Text variant="footnote" style={{ color, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function Lines({ widths }: { widths: number[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.lines}>
      {widths.map((w, i) => (
        <View key={i} style={[styles.line, { width: `${w}%`, backgroundColor: colors.fill }]} />
      ))}
    </View>
  );
}

export function WelcomeArt({ active, name, logo }: { active: boolean; name: string; logo?: string }) {
  const reduceMotion = useReducedMotion();
  const bubbles: { icon: IconName; style: object; delay: number }[] = [
    { icon: 'newspaper', style: { top: 6, left: 18 }, delay: 350 },
    { icon: 'calendar', style: { top: 0, right: 26 }, delay: 480 },
    { icon: 'tag', style: { bottom: 18, left: 4 }, delay: 610 },
    { icon: 'people', style: { bottom: 8, right: 10 }, delay: 740 },
    { icon: 'poll', style: { top: 92, right: -6 }, delay: 870 },
  ];
  return (
    <View style={styles.welcome}>
      <Animated.View key={active ? 'on' : 'off'} entering={active && !reduceMotion ? ZoomIn.duration(500).easing(SETTLE) : undefined} style={styles.logo}>
        <Avatar name={name} uri={logo} size={104} />
      </Animated.View>
      {bubbles.map((b) => (
        <Animated.View
          key={`${b.icon}-${active}`}
          entering={active && !reduceMotion ? ZoomIn.delay(b.delay).duration(380) : undefined}
          style={[styles.bubble, b.style]}>
          <Icon name={b.icon} size={22} color="#FFFFFF" />
        </Animated.View>
      ))}
    </View>
  );
}

export function ActusArt({ active }: { active: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <MockCard active={active}>
        <View style={[styles.cardHead, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
            ACTU ASSO
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text variant="headline">Assemblée générale : réservez la date</Text>
          <Lines widths={[92, 70]} />
          <View style={[styles.footer, { borderTopColor: colors.separator }]}>
            <Icon name="heartFill" size={16} color={LIKED} />
            <Text variant="footnote" style={{ color: LIKED, fontWeight: '600' }}>
              12
            </Text>
            <Icon name="comment" size={16} color={colors.textSecondary} />
            <Text variant="footnote" tone="secondary">
              3
            </Text>
            <View style={styles.spacer} />
            <Pulse active={active}>
              <Pill label="Lu" icon="check" color={colors.primary} background={colors.primarySoft} />
            </Pulse>
          </View>
        </View>
      </MockCard>
      <MockCard active={active} delay={260} style={styles.compact}>
        <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
        <View style={styles.spacer}>
          <Text variant="subhead" tone="secondary" numberOfLines={1} style={styles.bold}>
            Permanences : nouveaux horaires
          </Text>
        </View>
        <Icon name="check" size={13} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary" style={styles.bold}>
          Lue
        </Text>
      </MockCard>
    </View>
  );
}

export function AgendaArt({ active }: { active: boolean }) {
  const { colors } = useTheme();
  // A date a few days ahead, fixed for the session (the tile only shows its day and month).
  const [date] = useState(() => new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10));
  return (
    <MockCard active={active}>
      <View style={styles.cardBody}>
        <View style={styles.row}>
          <DateTile date={date} onCard />
          <View style={styles.spacer}>
            <Text variant="headline">Marché de Noël</Text>
            <Text variant="footnote" tone="secondary">
              09:00 · Place du village
            </Text>
          </View>
        </View>
        <Text variant="footnote" tone="secondary" style={styles.bold}>
          Vous venez ?
        </Text>
        <View style={styles.row}>
          <Pulse active={active} radius={12}>
            <Pill label="Présent" icon="checkCircle" color="#FFFFFF" background={colors.success} />
          </Pulse>
          <Pill label="Absent" color={colors.textSecondary} background={colors.fill} />
          <Pill label="Je ne sais pas" color={colors.textSecondary} background={colors.fill} />
        </View>
        <View style={[styles.footer, { borderTopColor: colors.separator }]}>
          <Icon name="calendarAdd" size={16} color={colors.primary} />
          <Text variant="subhead" tone="primary" style={styles.bold}>
            Ajouter à l’agenda
          </Text>
        </View>
      </View>
    </MockCard>
  );
}

export function OffresArt({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const offers = [
    { who: 'ATELIER CAMILLE', title: 'Retouches à tarif préférentiel', tag: '-15 %' },
    { who: 'CAFÉ DU CENTRE', title: 'Un café offert', tag: 'Offert' },
  ];
  return (
    <View style={styles.stack}>
      {offers.map((o, i) => (
        <MockCard key={o.title} active={active} delay={i * 220}>
          <View style={[styles.cardBody, styles.row]}>
            <View style={styles.spacer}>
              <Text variant="caption" tone="secondary" style={styles.bold}>
                {o.who}
              </Text>
              <Text variant="headline">{o.title}</Text>
            </View>
            {i === 0 ? (
              <Pulse active={active} radius={10}>
                <Pill label={o.tag} color="#FFFFFF" background={colors.primary} />
              </Pulse>
            ) : (
              <Pill label={o.tag} color={colors.primary} background={colors.primarySoft} />
            )}
          </View>
        </MockCard>
      ))}
    </View>
  );
}

export function AnnuaireArt({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const people = [
    { name: 'Café du Centre', who: 'Paul Durand' },
    { name: 'Fleuriste Les Pétales', who: 'Julie Bernard' },
  ];
  return (
    <View style={styles.stack}>
      <MockCard active={active} style={styles.search}>
        <Text tone="secondary">Rechercher un membre…</Text>
      </MockCard>
      {people.map((p, i) => (
        <MockCard key={p.name} active={active} delay={180 + i * 200}>
          <View style={[styles.cardBody, styles.row]}>
            <Avatar name={p.name} size={44} />
            <View style={styles.spacer}>
              <Text variant="headline">{p.name}</Text>
              <Text variant="footnote" tone="secondary">
                {p.who}
              </Text>
            </View>
            {i === 0 ? (
              <Pulse active={active}>
                <View style={[styles.round, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="phone" size={17} color={colors.primary} />
                </View>
              </Pulse>
            ) : (
              <View style={[styles.round, { backgroundColor: colors.primarySoft }]}>
                <Icon name="mail" size={17} color={colors.primary} />
              </View>
            )}
          </View>
        </MockCard>
      ))}
    </View>
  );
}

export function SondageArt({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const options = [
    { label: 'Mardi soir', pct: 58 },
    { label: 'Jeudi soir', pct: 30 },
    { label: 'Samedi matin', pct: 12 },
  ];
  return (
    <MockCard active={active}>
      <View style={styles.cardBody}>
        <Text variant="caption" tone="primary" style={styles.bold}>
          SONDAGE
        </Text>
        <Text variant="headline">Quel jour pour la prochaine rencontre ?</Text>
        {options.map((o, i) => (
          <View key={o.label} style={[styles.option, { backgroundColor: colors.fill }]}>
            <Animated.View
              key={`${o.label}-${active}`}
              entering={active && !reduceMotion ? FadeInDown.delay(300 + i * 150).duration(400) : undefined}
              style={[
                styles.optionBar,
                { width: `${o.pct}%`, backgroundColor: i === 0 ? colors.primary : colors.primarySoft },
              ]}
            />
            <Text variant="subhead" style={[styles.bold, i === 0 && { color: '#FFFFFF' }]}>
              {o.label}
            </Text>
            <View style={styles.spacer} />
            <Text variant="footnote" style={[styles.bold, i === 0 && { color: '#FFFFFF' }]}>
              {o.pct} %
            </Text>
          </View>
        ))}
      </View>
    </MockCard>
  );
}

export function PlusArt({ active, rows }: { active: boolean; rows: { icon: IconName; label: string; highlight?: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <MockCard active={active} style={styles.list}>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
          <View style={[styles.listIcon, { backgroundColor: colors.primarySoft }]}>
            <Icon name={r.icon} size={15} color={colors.primary} />
          </View>
          <Text style={styles.spacer}>{r.label}</Text>
          {r.highlight ? (
            <Pulse active={active}>
              <Icon name="chevron" size={14} color={colors.primary} />
            </Pulse>
          ) : (
            <Icon name="chevron" size={14} color={colors.textSecondary} />
          )}
        </View>
      ))}
    </MockCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  cardBody: { padding: 14, gap: 10 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, opacity: 0.92 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  spacer: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bold: { fontWeight: '700' },
  lines: { gap: 6 },
  line: { height: 8, borderRadius: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  pulse: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: '#FBBF24' },
  welcome: { height: 230, justifyContent: 'center', alignItems: 'center' },
  logo: { borderRadius: 30, overflow: 'hidden', borderWidth: 4, borderColor: 'rgba(255,255,255,0.35)' },
  bubble: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, paddingHorizontal: 12, overflow: 'hidden' },
  optionBar: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  list: { paddingVertical: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  listIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
