import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { libelleDeLEtat, libelleDeTranche } from '@/lib/creneaux';
import type { CaseDuPlanning } from '@/lib/mes-creneaux';
import { useTheme } from '@/theme';
import { tint } from '@/theme/colors';

type Props = { creneau: CaseDuPlanning; dureeMinutes: number; estChoisi: boolean; onChoisir: () => void };

/**
 * Une case du planning, l'heure au-dessus de son état écrit en toutes lettres (DESIGN.md,
 * « Créneaux de présence ») : vert, ambre, gris pour complet. Les créneaux de la personne ne
 * sont pas des pastilles mais des billets, en haut de l'écran (billet-de-creneau.tsx).
 */
export function PastilleDeCreneau({ creneau, dureeMinutes, estChoisi, onChoisir }: Props) {
  const { colors, scheme } = useTheme();
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
  );
}

const styles = StyleSheet.create({
  pastille: { minWidth: 124, minHeight: 56, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  heure: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  etat: { fontWeight: '600' },
});
