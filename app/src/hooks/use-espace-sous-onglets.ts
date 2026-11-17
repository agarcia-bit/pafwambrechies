import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sur iOS, la barre d'onglets flotte au-dessus du contenu : sans cette marge, le bas de la
// dernière carte (J'aime, Lu…) reste caché dessous et ne peut plus être touché.
// Sur Android, la barre est posée sous l'écran : une marge ordinaire suffit.
const HAUTEUR_BARRE_IOS = 80;
const MARGE_ORDINAIRE = 32;

/** La marge à laisser en bas d'une liste d'onglet pour que tout reste visible et cliquable. */
export function useEspaceSousOnglets() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom + HAUTEUR_BARRE_IOS : MARGE_ORDINAIRE;
}
