import { Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { libelleDeLEtat, libelleDeTranche } from '@/lib/creneaux';
import type { CaseDuPlanning } from '@/lib/mes-creneaux';
import { useTheme } from '@/theme';
import { tint } from '@/theme/colors';

type Props = { creneau: CaseDuPlanning; dureeMinutes: number; estChoisi: boolean; onChoisir: () => void };

/**
 * Une case du planning, l'heure au-dessus de son état écrit en toutes lettres (DESIGN.md,
 * « Créneaux de présence ») : « Vous » en couleur de l'association, vert, ambre, gris pour complet.
 * Quand elle devient « Vous », elle apparaît avec un léger rebond : le seul effet de l'écran.
 */
export function PastilleDeCreneau({ creneau, dureeMinutes, estChoisi, onChoisir }: Props) {
  const { colors, scheme } = useTheme();
  const moinsDAnimations = useReducedMotion();
  const teinte = {
    vous: { background: colors.primary, color: colors.onPrimary },
    libre: tint(scheme, colors.success),
    derniere: tint(scheme, colors.warning),
    complet: { background: colors.fill, color: colors.textSecondary },
    ferme: { background: colors.fill, color: colors.textSecondary },
  }[creneau.etat];
  const horaire = libelleDeTranche(creneau.heure, dureeMinutes);
  const etat = libelleDeLEtat(creneau.etat, creneau.libres);
  const estComplet = creneau.etat === 'complet';
  return (
    <Animated.View key={creneau.etat} entering={creneau.etat === 'vous' && !moinsDAnimations ? ZoomIn.springify().damping(14).duration(260) : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${horaire}, ${etat}`}
        accessibilityState={{ selected: estChoisi, disabled: estComplet }}
        disabled={estComplet}
        onPress={onChoisir}
        style={({ pressed }) => [
          styles.pastille,
          { backgroundColor: teinte.background, opacity: pressed ? 0.7 : 1 },
          estChoisi && { borderColor: colors.text },
        ]}>
        <Text variant="subhead" style={[styles.heure, { color: teinte.color }]}>{horaire}</Text>
        <Text variant="caption" style={[styles.etat, { color: teinte.color }]}>{etat}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pastille: { minWidth: 132, minHeight: 56, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  heure: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  etat: { fontWeight: '600' },
});
