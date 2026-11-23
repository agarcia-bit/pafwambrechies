import { createContext, use, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LARGEUR_DE_LECTURE, margesDeLecture, type Marges } from '@/lib/marges-de-lecture';

const MargeDeLecture = createContext<Marges>({ gauche: 0, droite: 0 });

/**
 * Les marges d'un écran en pleine largeur (accueil d'un onglet) : la liste les met en marges
 * intérieures pour garder ses cartes centrées et hors des bords occupés, la bande de couleur les
 * déborde pour toucher les bords. Ailleurs, 0.
 */
export function useMargeDeLecture() {
  return use(MargeDeLecture);
}

/**
 * Entoure chaque écran d'une pile de navigation. Sur l'iPhone Duo, l'heure, le Wi-Fi et la barre
 * d'onglets se placent sur le côté droit : la zone sûre native (celle de la vue, pas celle de la
 * fenêtre) en tient compte et garde le contenu hors de dessous. Sur grand écran, le contenu reste
 * centré dans une largeur lisible au lieu de s'étirer d'un bord à l'autre ; en pleine largeur
 * (accueil d'un onglet), l'écran garde toute la largeur et reçoit la marge à appliquer lui-même.
 */
export function ZoneDeLecture({ children, pleineLargeur = false }: { children: ReactNode; pleineLargeur?: boolean }) {
  const insets = useSafeAreaInsets();
  const [largeur, setLargeur] = useState(0);
  if (pleineLargeur) {
    const mesurer = (evenement: LayoutChangeEvent) => setLargeur(evenement.nativeEvent.layout.width);
    // Ici les écrans d'accueil d'onglet ne sont jamais des feuilles : les marges de la fenêtre sont justes.
    const marges = margesDeLecture(largeur, { gauche: insets.left, droite: insets.right });
    return (
      <View style={styles.zone} onLayout={mesurer}>
        <MargeDeLecture value={marges}>{children}</MargeDeLecture>
      </View>
    );
  }
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.zone}>
      <View style={styles.colonne}>{children}</View>
    </SafeAreaView>
  );
}

/**
 * À passer à `screenLayout` d'une pile : `<Stack screenLayout={entourerDUneZoneDeLecture}>`.
 * L'accueil de chaque onglet (« index ») a une bande de couleur qui doit toucher les bords.
 */
export function entourerDUneZoneDeLecture({ children, route }: { children: ReactNode; route: { name: string } }) {
  return <ZoneDeLecture pleineLargeur={route.name === 'index'}>{children}</ZoneDeLecture>;
}

const styles = StyleSheet.create({
  zone: { flex: 1 },
  colonne: { flex: 1, width: '100%', maxWidth: LARGEUR_DE_LECTURE, alignSelf: 'center' },
});
