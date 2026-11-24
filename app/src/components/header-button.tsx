import { Platform, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Text button for navigation bars ("Annuler"). */
export function HeaderButton({ title, onPress, bold }: { title: string; onPress: () => void; bold?: boolean }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress} style={styles.zone}>
      {({ pressed }) => (
        <Text tone="primary" style={[styles.texte, { opacity: pressed ? 0.5 : 1 }, bold && { fontWeight: '600' }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Bouton « + » de la barre du haut (nouvelle action, nouvelle idée…). */
export function BoutonPlusDeLaBarre({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={libelle} hitSlop={10} onPress={onPress} style={styles.zone}>
      <Icon name="plus" size={22} color={Platform.OS === 'android' ? '#FFFFFF' : undefined} />
    </Pressable>
  );
}

// Sur Android, la barre du haut est pleine, à la couleur de l'association : le bleu y devenait
// illisible et le bouton touchait le titre. Sur iPhone, la bulle du système garde le bleu.
const styles = StyleSheet.create({
  zone: Platform.OS === 'android' ? { marginHorizontal: 4, minWidth: 44, minHeight: 44, justifyContent: 'center' } : {},
  texte: Platform.OS === 'android' ? { color: '#FFFFFF', fontWeight: '600' } : {},
});
