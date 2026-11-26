import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { EtatDeMiseAJour } from '@/lib/mise-a-jour';
import { useTheme } from '@/theme';

/** Recouvre l'app le temps d'une mise à jour, pour que le rechargement ne surprenne personne. */
export function EcranMiseAJour({ etat, onContinuer }: { etat: EtatDeMiseAJour; onContinuer: () => void }) {
  const { colors } = useTheme();
  if (etat === 'rien') return null;
  const estEnCours = etat === 'en-cours';
  return (
    <View style={[StyleSheet.absoluteFill, styles.ecran, { backgroundColor: colors.background }]}
      accessibilityViewIsModal accessibilityLiveRegion="polite">
      {estEnCours && <ActivityIndicator size="large" color={colors.primary} />}
      <Text variant="title" style={styles.texte}>
        {estEnCours ? 'Mise à jour en cours…' : 'Mise à jour prête'}
      </Text>
      <Text variant="subhead" tone="secondary" style={styles.texte}>
        {estEnCours ? 'Quelques secondes, l’application redémarre toute seule.' : 'Fermez l’application puis rouvrez-la pour en profiter.'}
      </Text>
      {!estEnCours && <Button title="Continuer sans attendre" variant="secondary" onPress={onContinuer} style={styles.bouton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  texte: { textAlign: 'center' },
  bouton: { marginTop: 16 },
});
