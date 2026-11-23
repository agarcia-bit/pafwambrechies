import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Au-delà, les lignes deviennent trop longues à lire (grand écran de l'iPhone Duo ouvert). */
export const LARGEUR_DE_LECTURE = 640;

/**
 * Entoure chaque écran d'une pile de navigation. Sur l'iPhone Duo, l'heure, le Wi-Fi et la barre
 * d'onglets se placent sur le côté droit : la zone sûre native (celle de la vue, pas celle de la
 * fenêtre) en tient compte et garde le contenu hors de dessous. Sur grand écran, le contenu reste
 * centré dans une largeur lisible au lieu de s'étirer d'un bord à l'autre.
 */
export function ZoneDeLecture({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.zone}>
      <View style={styles.colonne}>{children}</View>
    </SafeAreaView>
  );
}

/** À passer à `screenLayout` d'une pile : `<Stack screenLayout={entourerDUneZoneDeLecture}>`. */
export function entourerDUneZoneDeLecture({ children }: { children: ReactNode }) {
  return <ZoneDeLecture>{children}</ZoneDeLecture>;
}

const styles = StyleSheet.create({
  zone: { flex: 1 },
  colonne: { flex: 1, width: '100%', maxWidth: LARGEUR_DE_LECTURE, alignSelf: 'center' },
});
