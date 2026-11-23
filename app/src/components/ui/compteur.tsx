import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

type Props = {
  valeur: number;
  onChanger: (valeur: number) => void;
  min?: number;
  max?: number;
  /** Ce que compte le compteur, pour les lecteurs d'écran (« personnes en même temps »). */
  libelle: string;
};

/** « −  2  + » : un petit nombre qu'on règle au doigt, avec des boutons de 44 px. */
export function Compteur({ valeur, onChanger, min = 0, max = 50, libelle }: Props) {
  const { colors } = useTheme();
  const bouton = (signe: '−' | '+', cible: number, actif: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${signe === '+' ? 'Une de plus' : 'Une de moins'} : ${libelle}`}
      accessibilityState={{ disabled: !actif }}
      disabled={!actif}
      onPress={() => onChanger(cible)}
      style={({ pressed }) => [styles.bouton, { backgroundColor: colors.fill, opacity: actif ? (pressed ? 0.6 : 1) : 0.35 }]}>
      <Text variant="headline" style={{ color: colors.primary }}>{signe}</Text>
    </Pressable>
  );
  return (
    <View style={styles.ligne} accessible={false}>
      {bouton('−', valeur - 1, valeur > min)}
      <Text variant="headline" style={styles.valeur} accessibilityLabel={`${valeur} ${libelle}`}>{valeur}</Text>
      {bouton('+', valeur + 1, valeur < max)}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bouton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  valeur: { minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
