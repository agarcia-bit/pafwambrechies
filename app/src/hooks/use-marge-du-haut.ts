import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * La hauteur à laisser en haut d'un écran pour ne rien cacher sous l'heure et la batterie.
 * Sur Android, dans les onglets, la marge mesurée vaut 0 alors que l'écran passe sous la barre
 * d'état : le titre se retrouvait coupé. On garde donc la plus grande des deux mesures.
 */
export function margeDuHaut(insetHaut: number, barreDEtat: number | null | undefined): number {
  return Math.max(insetHaut, barreDEtat ?? 0);
}

export function useMargeDuHaut(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' ? margeDuHaut(insets.top, StatusBar.currentHeight) : insets.top;
}
